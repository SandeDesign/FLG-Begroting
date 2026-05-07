import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Send, Search, Calendar, Euro, Building2, User, CheckCircle, AlertCircle, Clock, Edit, Trash2, ChevronDown, X, ArrowLeft, TrendingUp, Eye, Factory, Copy, MailCheck, MailX, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import Card from '../components/ui/Card';
import { outgoingInvoiceService, OutgoingInvoice, CompanyInfo } from '../services/outgoingInvoiceService';
import { collection, getDocs, query, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { usePageTitle } from '../contexts/PageTitleContext';
import { isInQuarter } from '../utils/dateFilters';

const MAKE_WEBHOOK_URL = 'https://hook.eu2.make.com/ttdixmxlu9n7rvbnxgfomilht2ihllc2';

interface InvoiceItem {
  title: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface InvoiceRelation {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: { street: string; city: string; zipCode: string; country: string };
  kvk?: string;
  taxNumber?: string;
}

interface ProductionEntry {
  monteur: string;
  datum: string;
  uren: number;
  opdrachtgever: string;
  locaties: string;
}

interface ProductionWeek {
  id: string;
  week: number;
  year: number;
  employeeId: string;
  entries: ProductionEntry[];
  totalHours: number;
}

const OutgoingInvoices: React.FC = () => {
  const { user, userRole } = useAuth();
  const { selectedCompany, employees, queryUserId, selectedYear, selectedQuarter } = useApp();
  const isReadOnly = userRole === 'boekhouder';
  const { success, error: showError } = useToast();
  usePageTitle('Facturen');

  const [invoices, setInvoices] = useState<OutgoingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [sendingWebhook, setSendingWebhook] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [editingInvoice, setEditingInvoice] = useState<OutgoingInvoice | null>(null);
  const [relations, setRelations] = useState<InvoiceRelation[]>([]);
  const [isRelationsOpen, setIsRelationsOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [vatRate, setVatRate] = useState<0 | 9 | 21>(21);

  // Production Import State
  const [showProductionImport, setShowProductionImport] = useState(false);
  const [productionWeeks, setProductionWeeks] = useState<ProductionWeek[]>([]);
  const [selectedProductionWeeks, setSelectedProductionWeeks] = useState<ProductionWeek[]>([]);
  const [selectedProductionEmployeeId, setSelectedProductionEmployeeId] = useState('');
  const [selectedProductionWeekIds, setSelectedProductionWeekIds] = useState<string[]>([]);
  const [loadingProduction, setLoadingProduction] = useState(false);
  const [invoicedWeekIds, setInvoicedWeekIds] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    clientId: '',
    clientName: '',
    clientEmail: '',
    clientAddress: { street: '', city: '', zipCode: '', country: 'Nederland' },
    clientPhone: '',
    clientKvk: '',
    clientTaxNumber: '',
    description: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    purchaseOrder: '',
    projectCode: ''
  });

  const [items, setItems] = useState<InvoiceItem[]>([{ title: '', description: '', quantity: 1, rate: 0, amount: 0 }]);
  const [additionalRecipients, setAdditionalRecipients] = useState<string[]>([]);

  const loadInvoices = useCallback(async () => {
    const effectiveUserId = queryUserId || selectedCompany?.userId;
    if (!user || !selectedCompany || !effectiveUserId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await outgoingInvoiceService.getInvoices(effectiveUserId, selectedCompany.id);
      setInvoices(data);
    } catch (e) {
      showError('Fout', 'Kon facturen niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, queryUserId, showError]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const loadRelations = useCallback(async () => {
    if (!user || !selectedCompany || !queryUserId) return;
    try {
      const q = query(collection(db, 'invoiceRelations'), where('userId', '==', queryUserId), where('companyId', '==', selectedCompany.id));
      const snap = await getDocs(q);
      setRelations(snap.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceRelation)));
    } catch (e) {
      console.error(e);
    }
  }, [user, selectedCompany, queryUserId]);

  const generateNextInvoiceNumber = useCallback(async () => {
    if (!user || !selectedCompany || !queryUserId) return;
    try {
      const num = await outgoingInvoiceService.getNextInvoiceNumber(queryUserId, selectedCompany.id);
      setInvoiceNumber(num);
    } catch (e) {
      console.error(e);
    }
  }, [user, selectedCompany, queryUserId]);

  // Load which weeks have already been invoiced for an employee
  const loadInvoicedWeeks = async (employeeId: string) => {
    if (!user || !selectedCompany || !queryUserId) return new Set<string>();

    try {
      const invoiceData = await outgoingInvoiceService.getInvoices(queryUserId, selectedCompany.id);

      const employee = employees.find(e => e.id === employeeId);
      const employeeName = employee
        ? `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
        : '';

      const usedWeekIds = new Set<string>();

      invoiceData.forEach(invoice => {
        invoice.items.forEach(item => {
          if (item.title && employeeName && item.title.includes(employeeName)) {
            const weekMatch = item.title.match(/Week (\d+)/);
            if (weekMatch) {
              usedWeekIds.add(`week-${weekMatch[1]}-${employeeId}`);
            }
          }
        });
      });

      return usedWeekIds;
    } catch (error) {
      console.error('Error loading invoiced weeks:', error);
      return new Set<string>();
    }
  };

  // Load production weeks when employee is selected
  const handleLoadProductionWeeks = async () => {
    if (!selectedProductionEmployeeId || !user || !selectedCompany || !queryUserId) {
      console.error('❌ Missing data:', { selectedProductionEmployeeId, user: !!user, selectedCompany: !!selectedCompany, queryUserId: !!queryUserId });
      showError('Fout', 'Selecteer een medewerker');
      return;
    }

    console.log('🔄 Loading production weeks for employee:', selectedProductionEmployeeId);
    setLoadingProduction(true);
    try {
      const invoicedIds = await loadInvoicedWeeks(selectedProductionEmployeeId);
      setInvoicedWeekIds(invoicedIds);

      const q = query(
        collection(db, 'productionWeeks'),
        where('userId', '==', queryUserId),
        where('companyId', '==', selectedCompany.id),
        where('employeeId', '==', selectedProductionEmployeeId),
        orderBy('year', 'desc'),
        orderBy('week', 'desc')
      );

      const snap = await getDocs(q);
      console.log('✅ Got snapshots:', snap.size);

      const weeks: ProductionWeek[] = [];

      snap.docs.forEach(doc => {
        const data = doc.data();
        console.log('📋 Week data:', { week: data.week, year: data.year, entries: data.entries?.length });
        weeks.push({
          id: doc.id,
          week: data.week,
          year: data.year,
          employeeId: data.employeeId,
          entries: data.entries || [],
          totalHours: data.totalHours || 0
        });
      });

      console.log('✅ Loaded weeks:', weeks.length);
      setProductionWeeks(weeks);
      setSelectedProductionWeekIds([]);
      setSelectedProductionWeeks([]);

      if (weeks.length === 0) {
        showError('Geen data', `Geen productie weken gevonden`);
      } else {
        success('Geladen', `${weeks.length} weken gevonden`);
      }
    } catch (error) {
      console.error('❌ Error loading production weeks:', error);
      showError('Fout', `Kon productie weken niet laden: ${error instanceof Error ? error.message : 'Onbekend'}`);
    } finally {
      setLoadingProduction(false);
    }
  };

  const handleWeekToggle = (weekId: string) => {
    const week = productionWeeks.find(w => w.id === weekId);
    if (!week) return;

    const isSelected = selectedProductionWeekIds.includes(weekId);

    if (isSelected) {
      setSelectedProductionWeekIds(prev => prev.filter(id => id !== weekId));
      setSelectedProductionWeeks(prev => prev.filter(w => w.id !== weekId));
    } else {
      setSelectedProductionWeekIds(prev => [...prev, weekId]);
      setSelectedProductionWeeks(prev => [...prev, week]);
    }
  };

  const isWeekInvoiced = (week: ProductionWeek): boolean => {
    const key = `week-${week.week}-${week.employeeId}`;
    return invoicedWeekIds.has(key);
  };

  const selectAllUninvoiced = () => {
    const uninvoicedWeeks = productionWeeks.filter(w => !isWeekInvoiced(w));
    setSelectedProductionWeekIds(uninvoicedWeeks.map(w => w.id));
    setSelectedProductionWeeks(uninvoicedWeeks);
  };

  const clearWeekSelection = () => {
    setSelectedProductionWeekIds([]);
    setSelectedProductionWeeks([]);
  };

  const handleDeleteProductionWeek = async (weekId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Weet je zeker dat je deze week wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) return;
    try {
      await deleteDoc(doc(db, 'productionWeeks', weekId));
      setProductionWeeks(prev => prev.filter(w => w.id !== weekId));
      setSelectedProductionWeekIds(prev => prev.filter(id => id !== weekId));
      setSelectedProductionWeeks(prev => prev.filter(w => w.id !== weekId));
      success('Verwijderd', 'Week verwijderd uit de lijst');
    } catch (error) {
      showError('Fout', 'Kon week niet verwijderen');
    }
  };

  const addAllProductionItems = () => {
    console.log('🚀 Adding production items...');

    if (selectedProductionWeeks.length === 0) {
      console.error('❌ No weeks selected');
      showError('Fout', 'Selecteer minimaal één week');
      return;
    }

    const employee = employees.find(e => e.id === selectedProductionEmployeeId);
    const employeeName = employee
      ? `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
      : 'Onbekend';

    const rate = selectedCompany?.hourlyRate || 41.31;
    const newItems: InvoiceItem[] = [];

    selectedProductionWeeks.forEach(week => {
      if (!week.entries || week.entries.length === 0) {
        console.warn(`⚠️ Week ${week.week} has no entries, skipping`);
        return;
      }

      const tableHeader = 'Monteur\tDatum\tUren\tOpdrachtgever\tLocaties';
      const tableRows = week.entries
        .map(entry => `${entry.monteur}\t${entry.datum}\t${entry.uren}\t${entry.opdrachtgever}\t${entry.locaties}`)
        .join('\n');

      const description = `${tableHeader}\n${tableRows}`;
      const totalUren = week.totalHours;
      const amount = totalUren * rate;

      const newItem: InvoiceItem = {
        title: `Week ${week.week} ${employeeName}`,
        description: description,
        quantity: totalUren,
        rate: rate,
        amount: amount
      };

      console.log('✅ New item:', { title: newItem.title, quantity: newItem.quantity, rate: newItem.rate, amount: newItem.amount });
      newItems.push(newItem);
    });

    if (newItems.length === 0) {
      showError('Fout', 'Geen weken met entries gevonden');
      return;
    }

    const updatedItems = items.filter(i => i.title.trim() !== '');
    setItems([...updatedItems, ...newItems]);

    setSelectedProductionWeeks([]);
    setSelectedProductionWeekIds([]);
    setProductionWeeks([]);
    setSelectedOpdrachtgever('');
    setSelectedProductionEmployeeId('');
    setShowProductionImport(false);

    success('✅ Toegevoegd', `${newItems.length} week(en) toegevoegd aan factuur`);
  };

  const handleCreateNew = () => {
    setEditingInvoice(null);
    setFormData({
      clientId: '',
      clientName: '',
      clientEmail: '',
      clientAddress: { street: '', city: '', zipCode: '', country: 'Nederland' },
      clientPhone: '',
      clientKvk: '',
      clientTaxNumber: '',
      description: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: '',
      purchaseOrder: '',
      projectCode: ''
    });
    setItems([{ title: '', description: '', quantity: 1, rate: 0, amount: 0 }]);
    setShowProductionImport(false);
    setProductionWeeks([]);
    setSelectedProductionWeeks([]);
    setSelectedProductionEmployeeId('');
    setSelectedProductionWeekIds([]);
    setInvoicedWeekIds(new Set());
    setVatRate(21);
    loadRelations();
    generateNextInvoiceNumber();
    setView('create');
  };

  const handleEdit = (inv: OutgoingInvoice) => {
    setEditingInvoice(inv);
    setFormData({
      clientId: inv.clientId || '',
      clientName: inv.clientName,
      clientEmail: inv.clientEmail,
      clientAddress: inv.clientAddress,
      clientPhone: inv.clientPhone || '',
      clientKvk: inv.clientKvk || '',
      clientTaxNumber: inv.clientTaxNumber || '',
      description: inv.description,
      invoiceDate: inv.invoiceDate.toISOString().split('T')[0],
      dueDate: inv.dueDate.toISOString().split('T')[0],
      notes: inv.notes || '',
      purchaseOrder: inv.purchaseOrder || '',
      projectCode: inv.projectCode || ''
    });
    setItems(inv.items);
    setInvoiceNumber(inv.invoiceNumber);
    loadRelations();
    setView('create');
  };

  const handleSelectRelation = (rel: InvoiceRelation) => {
    setFormData({
      ...formData,
      clientId: rel.id,
      clientName: rel.name,
      clientEmail: rel.email,
      clientPhone: rel.phone || '',
      clientKvk: rel.kvk || '',
      clientTaxNumber: rel.taxNumber || '',
      clientAddress: rel.address || { street: '', city: '', zipCode: '', country: 'Nederland' }
    });

    // Laad standaard extra ontvangers
    if (rel.defaultAdditionalRecipients && rel.defaultAdditionalRecipients.length > 0) {
      setAdditionalRecipients(rel.defaultAdditionalRecipients);
    } else {
      setAdditionalRecipients([]);
    }

    setIsRelationsOpen(false);
  };

  const updateItem = (idx: number, field: keyof InvoiceItem, val: string | number) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: val };
    if (field === 'quantity' || field === 'rate') newItems[idx].amount = newItems[idx].quantity * newItems[idx].rate;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { title: '', description: '', quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeItem = (idx: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== idx));
  };

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompany) {
      showError('Fout', 'Geen gebruiker/bedrijf');
      return;
    }
    if (!formData.clientName.trim()) {
      showError('Fout', 'Klantnaam verplicht');
      return;
    }
    const validItems = items.filter(i => i.description.trim());
    if (validItems.length === 0) {
      showError('Fout', 'Minimaal 1 regel nodig');
      return;
    }

    setFormLoading(true);
    try {
      const data: Omit<OutgoingInvoice, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: queryUserId!,
        companyId: selectedCompany.id,
        invoiceNumber,
        clientId: formData.clientId,
        clientName: formData.clientName.trim(),
        clientEmail: formData.clientEmail.trim(),
        clientPhone: formData.clientPhone.trim(),
        clientKvk: formData.clientKvk.trim(),
        clientTaxNumber: formData.clientTaxNumber.trim(),
        clientAddress: formData.clientAddress,
        amount: subtotal,
        vatAmount,
        totalAmount: total,
        description: formData.description.trim(),
        purchaseOrder: formData.purchaseOrder.trim(),
        projectCode: formData.projectCode.trim(),
        additionalRecipients: additionalRecipients.length > 0 ? additionalRecipients : undefined,
        ExtraOntvangers: additionalRecipients.length > 0 ? 'ja' : 'nee',
        invoiceDate: new Date(formData.invoiceDate),
        dueDate: new Date(formData.dueDate),
        status: 'draft',
        items: validItems,
        notes: formData.notes.trim()
      };

      if (editingInvoice?.id) {
        await outgoingInvoiceService.updateInvoice(editingInvoice.id, data);
        success('Bijgewerkt', 'Factuur succesvol bijgewerkt');
      } else {
        await outgoingInvoiceService.createInvoice(data);
        success('Aangemaakt', 'Factuur succesvol aangemaakt');
      }
      loadInvoices();
      setView('list');
    } catch (e) {
      showError('Fout', 'Kon niet opslaan');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSendInvoice = async (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
      showError('Fout', 'Factuur niet gevonden');
      return;
    }
    setSendingWebhook(invoiceId);
    try {
      const info: CompanyInfo = {
        id: selectedCompany?.id || '',
        name: selectedCompany?.name || '',
        kvk: selectedCompany?.kvk || '',
        taxNumber: selectedCompany?.taxNumber || '',
        bankAccount: selectedCompany?.bankAccount || '',
        contactInfo: { email: selectedCompany?.contactInfo?.email || '', phone: selectedCompany?.contactInfo?.phone || '' },
        address: { street: selectedCompany?.address?.street || '', city: selectedCompany?.address?.city || '', zipCode: selectedCompany?.address?.zipCode || '', country: selectedCompany?.address?.country || '' },
        themeColor: selectedCompany?.themeColor,
        logoUrl: selectedCompany?.logoUrl,
      };
      const html = await outgoingInvoiceService.generateInvoiceHTML(invoice, info);
      const callbackUrl = `${window.location.origin}/api/invoice-delivery-callback`;
      const payload = {
        event: 'invoice.sent',
        timestamp: new Date().toISOString(),
        client: { name: invoice.clientName, email: invoice.clientEmail, phone: invoice.clientPhone || null },
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: 'sent',
          totalAmount: invoice.totalAmount,
          items: invoice.items,
          ExtraOntvangers: invoice.ExtraOntvangers || (invoice.additionalRecipients && invoice.additionalRecipients.length > 0 ? 'ja' : 'nee'),
          additionalRecipients: invoice.additionalRecipients || []
        },
        company: { id: selectedCompany?.id, name: selectedCompany?.name },
        user: { id: user?.uid, email: user?.email },
        htmlContent: html,
        callbackUrl,
      };
      const res = await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) throw new Error('Webhook error');
      await outgoingInvoiceService.sendInvoice(invoiceId);
      success('Verstuurd', 'Factuur succesvol verzonden');
      loadInvoices();
    } catch (e) {
      showError('Fout', 'Kon niet versturen');
    } finally {
      setSendingWebhook(null);
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      await outgoingInvoiceService.markAsPaid(invoiceId);
      success('Betaald', 'Factuur als betaald gemarkeerd');
      loadInvoices();
    } catch (e) {
      showError('Fout', 'Kon niet bijwerken');
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Weet u zeker dat u deze factuur wilt verwijderen?')) return;
    try {
      await outgoingInvoiceService.deleteInvoice(invoiceId);
      success('Verwijderd', 'Factuur verwijderd');
      loadInvoices();
    } catch (e) {
      showError('Fout', 'Kon niet verwijderen');
    }
  };

  const handleDuplicateInvoice = async (invoice: OutgoingInvoice) => {
    try {
      setFormLoading(true);

      // Generate new invoice number
      const newInvoiceNumber = await outgoingInvoiceService.getNextInvoiceNumber(queryUserId!, selectedCompany!.id);

      // Laad standaard extra ontvangers van de klant indien beschikbaar
      let defaultRecipients: string[] = [];
      if (invoice.clientId) {
        try {
          const relationDoc = await getDocs(
            query(
              collection(db, 'invoiceRelations'),
              where('userId', '==', queryUserId),
              where('companyId', '==', selectedCompany!.id)
            )
          );
          const relation = relationDoc.docs.find(doc => doc.id === invoice.clientId);
          if (relation) {
            defaultRecipients = relation.data().defaultAdditionalRecipients || [];
          }
        } catch (err) {
          console.log('Geen standaard ontvangers gevonden');
        }
      }

      // Copy invoice with fresh dates and status
      const newInvoice: Omit<OutgoingInvoice, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: queryUserId!,
        companyId: selectedCompany!.id,
        invoiceNumber: newInvoiceNumber,
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        clientPhone: invoice.clientPhone,
        clientKvk: invoice.clientKvk,
        clientTaxNumber: invoice.clientTaxNumber,
        clientAddress: invoice.clientAddress,
        amount: invoice.amount,
        vatAmount: invoice.vatAmount,
        totalAmount: invoice.totalAmount,
        description: invoice.description,
        purchaseOrder: invoice.purchaseOrder,
        projectCode: invoice.projectCode,
        additionalRecipients: defaultRecipients.length > 0 ? defaultRecipients : undefined,
        ExtraOntvangers: defaultRecipients.length > 0 ? 'ja' : 'nee',
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'draft',
        items: invoice.items,
        notes: invoice.notes
      };

      await outgoingInvoiceService.createInvoice(newInvoice);
      success('Gekopieerd', 'Factuur gedupliceerd naar nieuw concept');
      loadInvoices();
      setExpandedInvoice(null);
    } catch (e) {
      showError('Fout', 'Kon niet dupliceren');
    } finally {
      setFormLoading(false);
    }
  };

  const getStatusColor = (status: OutgoingInvoice['status']) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700',
      sent: 'bg-primary-50 text-primary-700 border-primary-200',
      paid: 'bg-green-50 text-green-700 border-green-200',
      partial: 'bg-orange-50 text-orange-700 border-orange-200',
      overdue: 'bg-red-50 text-red-700 border-red-200',
      cancelled: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'
    };
    return colors[status] || colors.draft;
  };

  const getDeliveryBadge = (invoice: OutgoingInvoice) => {
    if (invoice.status !== 'sent' && invoice.status !== 'overdue') return null;
    if (!invoice.deliveryStatus || invoice.deliveryStatus === 'pending') {
      return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800"><Loader2 className="h-2.5 w-2.5 animate-spin" />Wacht op bevestiging</span>;
    }
    if (invoice.deliveryStatus === 'delivered') {
      return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"><MailCheck className="h-2.5 w-2.5" />Bezorgd</span>;
    }
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"><MailX className="h-2.5 w-2.5" />Bezorging mislukt</span>;
  };

  const getStatusIcon = (status: OutgoingInvoice['status']) => {
    const icons = {
      draft: Clock,
      sent: Send,
      paid: CheckCircle,
      overdue: AlertCircle,
      cancelled: AlertCircle
    };
    return icons[status] || Clock;
  };

  const getStatusText = (status: OutgoingInvoice['status']) => {
    const texts = {
      draft: 'Concept',
      sent: 'Verstuurd',
      paid: 'Betaald',
      overdue: 'Vervallen',
      cancelled: 'Geannuleerd'
    };
    return texts[status] || status;
  };

  const filteredInvoices = invoices.filter(inv => {
    // Period filter
    const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
    if (!isInQuarter(invDate, selectedYear, selectedQuarter)) return false;
    // Search + status filter
    return (inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === 'all' || inv.status === statusFilter);
  });

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalVatAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.vatAmount || 0), 0);
  const totalExclBtw = filteredInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const draftCount = filteredInvoices.filter(inv => inv.status === 'draft').length;
  const sentCount = filteredInvoices.filter(inv => inv.status === 'sent').length;
  const paidCount = filteredInvoices.filter(inv => inv.status === 'paid').length;

  if (loading && view === 'list') {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <div className="hidden lg:block">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Facturen</h1>
        </div>
        <EmptyState
          icon={Building2}
          title="Geen bedrijf geselecteerd"
          description="Selecteer een bedrijf uit de dropdown in de zijbalk om facturen te beheren."
        />
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="space-y-4 sm:space-y-6 pb-24 sm:pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setView('list')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Terug"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div className="hidden lg:block">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              {editingInvoice ? 'Factuur bewerken' : 'Nieuwe factuur'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">{invoiceNumber}</p>
          </div>
        </div>

        <form onSubmit={handleSubmitInvoice} className="space-y-6">
          {/* Client Selection */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-primary-100 rounded-lg">
                <User className="h-4 w-4 text-primary-600" />
              </div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Klantgegevens</h2>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">Klant selecteren</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsRelationsOpen(!isRelationsOpen)}
                  className="w-full flex items-center justify-between p-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm hover:border-gray-300 transition-colors"
                >
                  <span className={formData.clientName ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-300 dark:text-gray-500'}>
                    {formData.clientName || 'Kies een klant...'}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${isRelationsOpen ? 'rotate-180' : ''}`} />
                </button>
                {isRelationsOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                    {relations.length === 0 ? (
                      <div className="p-4 text-xs text-gray-500 dark:text-gray-300 text-center">Geen relaties beschikbaar</div>
                    ) : (
                      relations.map(rel => (
                        <button
                          key={rel.id}
                          type="button"
                          onClick={() => handleSelectRelation(rel)}
                          className="w-full text-left px-4 py-3 hover:bg-primary-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{rel.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">{rel.email}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">Naam</label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                  placeholder="Bedrijfsnaam"
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">E-mail</label>
                <input
                  type="email"
                  value={formData.clientEmail}
                  onChange={e => setFormData({ ...formData, clientEmail: e.target.value })}
                  placeholder="klant@bedrijf.nl"
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">Telefoonnummer</label>
                <input
                  type="tel"
                  value={formData.clientPhone}
                  onChange={e => setFormData({ ...formData, clientPhone: e.target.value })}
                  placeholder="+31 6 12345678"
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">KvK-nummer</label>
                <input
                  type="text"
                  value={formData.clientKvk}
                  onChange={e => setFormData({ ...formData, clientKvk: e.target.value })}
                  placeholder="12345678"
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            </div>
          </Card>

          {/* Dates & VAT */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="h-4 w-4 text-orange-600" />
              </div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Datums & BTW</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">Factuurdatum</label>
                <input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors bg-white dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">Vervaldatum</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors bg-white dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-2">BTW Tarief</label>
              <div className="grid grid-cols-3 gap-2">
                {[0, 9, 21].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setVatRate(rate as 0 | 9 | 21)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${ vatRate === rate ? 'bg-primary-600 text-white border-2 border-primary-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-700 hover:border-primary-300' }`}
                  >
                    {rate}%
                    {rate === 0 && <span className="block text-xs mt-0.5">Verlegd</span>}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Invoice Items */}
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Factuurregels</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowProductionImport(!showProductionImport)}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
                >
                  <Factory className="h-4 w-4" />
                  Importeer data
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Regel toevoegen
                </button>
              </div>
            </div>

            {showProductionImport && (
              <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 rounded">
                      <Factory className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-amber-700">Production data import</p>
                      <p className="text-xs text-amber-600">Uit database</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductionImport(false);
                      setProductionWeeks([]);
                      setSelectedProductionWeeks([]);
                      setSelectedProductionEmployeeId('');
                      setSelectedProductionWeekIds([]);
                    }}
                    className="text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 space-y-3">
                  {/* Step 1: Employee Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-amber-900 mb-2">STAP 1: Selecteer medewerker</label>
                    <select
                      value={selectedProductionEmployeeId}
                      onChange={(e) => {
                        setSelectedProductionEmployeeId(e.target.value);
                        setProductionWeeks([]);
                        setSelectedProductionWeeks([]);
                        setSelectedProductionWeekIds([]);
                        setInvoicedWeekIds(new Set());
                      }}
                      className="w-full px-3 py-2 border-2 border-amber-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-gray-800"
                    >
                      <option value="">-- Kies medewerker --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Step 2: Load Button */}
                  {selectedProductionEmployeeId && (
                    <button
                      type="button"
                      onClick={handleLoadProductionWeeks}
                      disabled={loadingProduction}
                      className="w-full px-3 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 rounded transition-colors"
                    >
                      {loadingProduction ? '⏳ Laden...' : '📥 LAAD WEKEN'}
                    </button>
                  )}

                  {/* Step 3: Week Selector (Multi-select with checkboxes) */}
                  {productionWeeks.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-amber-900">STAP 2: Selecteer weken (meerdere mogelijk)</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={selectAllUninvoiced}
                            className="text-xs text-amber-700 hover:text-amber-900 underline"
                          >
                            Selecteer alle nieuwe
                          </button>
                          {selectedProductionWeekIds.length > 0 && (
                            <button
                              type="button"
                              onClick={clearWeekSelection}
                              className="text-xs text-red-600 hover:text-red-800 underline"
                            >
                              Wis selectie
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto border-2 border-amber-300 rounded bg-white dark:bg-gray-800">
                        {productionWeeks.map((week) => {
                          const invoiced = isWeekInvoiced(week);
                          const isSelected = selectedProductionWeekIds.includes(week.id);
                          return (
                            <div
                              key={week.id}
                              className={`group flex items-center gap-3 px-3 py-2 border-b border-amber-100 last:border-0 transition-colors ${ isSelected ? 'bg-amber-100' : invoiced ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-amber-50' }`}
                            >
                              <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleWeekToggle(week.id)}
                                  disabled={invoiced}
                                  className="h-4 w-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 disabled:opacity-50"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-medium ${invoiced ? 'text-gray-500 dark:text-gray-300' : 'text-amber-900'}`}>
                                      Week {week.week} ({week.year})
                                    </span>
                                    {invoiced && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700">
                                        ✓ Gefactureerd
                                      </span>
                                    )}
                                  </div>
                                  <span className={`text-xs ${invoiced ? 'text-gray-400 dark:text-gray-500' : 'text-amber-600'}`}>
                                    {week.entries.length} entries - {week.totalHours}u
                                  </span>
                                </div>
                              </label>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteProductionWeek(week.id, e)}
                                title="Week verwijderen"
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      {selectedProductionWeekIds.length > 0 && (
                        <div className="mt-2 p-2 bg-amber-100 rounded text-xs text-amber-800">
                          <strong>{selectedProductionWeekIds.length}</strong> week(en) geselecteerd -
                          Totaal: <strong>{selectedProductionWeeks.reduce((sum, w) => sum + w.totalHours, 0)}</strong> uren
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 4: Preview selected weeks */}
                  {selectedProductionWeeks.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-amber-900">STAP 3: Preview geselecteerde weken</p>
                      <div className="bg-white dark:bg-gray-800 border-2 border-amber-200 rounded p-2 max-h-48 overflow-y-auto space-y-3">
                        {selectedProductionWeeks.map((week) => (
                          <div key={week.id} className="border-b border-amber-200 pb-2 last:border-0 last:pb-0">
                            <div className="text-xs font-bold text-amber-900 mb-1">
                              Week {week.week} ({week.year}) - {week.totalHours}u
                            </div>
                            <div className="text-xs font-mono text-amber-800 space-y-0.5">
                              {week.entries.slice(0, 3).map((entry, idx) => (
                                <div key={idx} className="grid grid-cols-5 gap-1">
                                  <div className="truncate">{entry.monteur}</div>
                                  <div>{entry.datum}</div>
                                  <div className="text-right font-semibold">{entry.uren}u</div>
                                  <div className="truncate">{entry.opdrachtgever}</div>
                                  <div className="truncate text-amber-600">{entry.locaties}</div>
                                </div>
                              ))}
                              {week.entries.length > 3 && (
                                <div className="text-amber-500 italic">... en {week.entries.length - 3} meer</div>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="pt-2 border-t-2 border-amber-300 font-bold text-amber-900 text-xs">
                          Totaal alle weken: {selectedProductionWeeks.reduce((sum, w) => sum + w.totalHours, 0)} uren
                        </div>
                      </div>

                      {/* Step 5: Add Button */}
                      <button
                        type="button"
                        onClick={addAllProductionItems}
                        className="w-full px-3 py-3 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                      >
                        ✅ VOEG {selectedProductionWeeks.length} WEEK(EN) TOE AAN FACTUUR
                      </button>
                    </div>
                  )}

                  {productionWeeks.length === 0 && selectedProductionEmployeeId && !loadingProduction && (
                    <p className="text-xs text-amber-600 p-2 bg-amber-100 rounded">
                      ⚠️ Klik "LAAD WEKEN" om productie weken op te halen
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Titel</label>
                    <input
                      placeholder="Bijv: Week 40 Jan Jansen"
                      value={item.title}
                      onChange={e => updateItem(i, 'title', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Beschrijving</label>
                    <textarea
                      placeholder="Monteur	Datum	Uren	Opdrachtgever	Locaties"
                      value={item.description}
                      onChange={e => updateItem(i, 'description', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none font-mono bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Uren</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateItem(i, 'quantity', Number(e.target.value))}
                        min="0.1"
                        step="0.1"
                        className="w-full px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">€/uur</label>
                      <input
                        type="number"
                        value={item.rate}
                        onChange={e => updateItem(i, 'rate', Number(e.target.value))}
                        min="0"
                        step="0.01"
                        className="w-full px-2 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Bedrag</label>
                      <div className="w-full px-2 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-right text-gray-900 dark:text-gray-100">
                        €{item.amount.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-medium flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Verwijderen
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Totals */}
          <Card className="p-5 sm:p-6 bg-gradient-to-br from-primary-50 to-indigo-50 border-primary-200">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-300">Subtotaal:</span>
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">€{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-300">BTW ({vatRate}%):</span>
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">€{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-primary-200">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Totaal:</span>
                <span className="text-2xl font-bold text-primary-600">€{total.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card className="p-5 sm:p-6 space-y-4">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200">Opmerkingen</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Eventuele opmerkingen op deze factuur..."
              className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:border-primary-500 transition-colors resize-none"
            />
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 pb-8">
            <Button
              type="button"
              onClick={() => setView('list')}
              variant="secondary"
              className="flex-1"
            >
              Annuleren
            </Button>
            <Button
              type="submit"
              disabled={formLoading}
              className="flex-1"
            >
              {formLoading ? 'Bezig...' : editingInvoice ? 'Bijwerken' : 'Opslaan'}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Facturen</h1>
          <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
            {filteredInvoices.length} stuks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="secondary"
            size="sm"
            icon={showFilters ? X : Search}
          >
            {showFilters ? 'Sluiten' : 'Filter'}
          </Button>
          {!isReadOnly && (
            <Button onClick={handleCreateNew} icon={Plus} size="sm">
              Nieuw
            </Button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Zoeken..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-8 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:border-primary-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:border-primary-500 bg-white dark:bg-gray-800"
          >
            <option value="all">Alle</option>
            <option value="draft">Concept</option>
            <option value="sent">Verstuurd</option>
            <option value="paid">Betaald</option>
            <option value="overdue">Vervallen</option>
          </select>
        </div>
      )}

      {filteredInvoices.length === 0 ? (
        <div className="p-6 text-center border border-gray-200 dark:border-gray-700 rounded-lg">
          <Send className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {searchTerm
              ? 'Geen resultaten.'
              : isReadOnly
                ? 'Deze vestiging heeft nog geen verkoopfacturen.'
                : 'Maak uw eerste factuur aan.'}
          </p>
          {!searchTerm && !isReadOnly && (
            <Button onClick={handleCreateNew} icon={Plus} size="sm" className="mt-3">
              Nieuwe factuur
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Compact Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-200 sticky top-0 z-10">
            <div className="col-span-2">Nummer</div>
            <div className="col-span-3">Klant</div>
            <div className="col-span-2">Bedrag excl.</div>
            <div className="col-span-1">BTW</div>
            <div className="col-span-1">Datum</div>
            <div className="col-span-3">Status / Bezorging</div>
          </div>

          <div className="space-y-1">
            {filteredInvoices.map(invoice => {
              const StatusIcon = getStatusIcon(invoice.status);
              const isExpanded = expandedInvoice === invoice.id;
              const isLoading = sendingWebhook === invoice.id;

              return (
                <div key={invoice.id}>
                  {/* Desktop Row */}
                  <div className="hidden md:grid grid-cols-12 gap-2 items-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => setExpandedInvoice(isExpanded ? null : invoice.id)}>
                    <div className="col-span-2 text-xs font-semibold text-gray-900 dark:text-gray-100">{invoice.invoiceNumber}</div>
                    <div className="col-span-3 text-xs text-gray-700 dark:text-gray-300">{invoice.clientName}</div>
                    <div className="col-span-2 text-xs font-semibold text-gray-900 dark:text-gray-100">€{(invoice.amount || 0).toFixed(2)}</div>
                    <div className="col-span-1 text-xs text-gray-600 dark:text-gray-300">€{(invoice.vatAmount || 0).toFixed(2)}</div>
                    <div className="col-span-1 text-xs text-gray-600 dark:text-gray-300">{invoice.invoiceDate.toLocaleDateString('nl-NL')}</div>
                    <div className="col-span-3 flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-0.5 px-2 py-1 rounded text-xs font-semibold border ${getStatusColor(invoice.status)}`}>
                        <StatusIcon className="h-3 w-3" />
                        <span>{getStatusText(invoice.status)}</span>
                      </span>
                      {getDeliveryBadge(invoice)}
                    </div>
                    <div className="col-span-1 text-right">
                      <ChevronDown className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div className="md:hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedInvoice(isExpanded ? null : invoice.id)}
                      className="w-full p-3 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900"
                    >
                      <div className={`p-2 rounded flex-shrink-0 ${ invoice.status === 'paid' ? 'bg-green-100' : invoice.status === 'sent' ? 'bg-primary-100' : invoice.status === 'overdue' ? 'bg-red-100' : 'bg-gray-100 dark:bg-gray-800' }`}>
                        <StatusIcon className={`h-4 w-4 ${ invoice.status === 'paid' ? 'text-green-600' : invoice.status === 'sent' ? 'text-primary-600' : invoice.status === 'overdue' ? 'text-red-600' : 'text-gray-600 dark:text-gray-300 dark:text-gray-500' }`} />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">{invoice.invoiceNumber}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 truncate">{invoice.clientName}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">€{invoice.totalAmount.toFixed(2)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-300">{getStatusText(invoice.status)}</div>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-3 space-y-3">
                      {invoice.items.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3 space-y-1 text-xs">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Regels:</p>
                          {invoice.items.slice(0, 3).map((item, i) => (
                            <div key={i} className="text-gray-700 dark:text-gray-300">
                              <div className="font-medium">{item.title || 'Item'}</div>
                              {item.description && (
                                <div className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono text-xs mt-0.5">{item.description.substring(0, 80)}...</div>
                              )}
                              <div className="text-gray-600 dark:text-gray-300">{item.quantity}x €{item.rate.toFixed(2)} = €{item.amount.toFixed(2)}</div>
                            </div>
                          ))}
                          {invoice.items.length > 3 && (
                            <p className="text-gray-500 dark:text-gray-300 italic">+{invoice.items.length - 3} meer</p>
                          )}
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-1 mt-1 space-y-0.5">
                            <div className="flex justify-between text-gray-600 dark:text-gray-300">
                              <span>Subtotaal:</span>
                              <span>€{(invoice.amount || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-600 dark:text-gray-300">
                              <span>BTW:</span>
                              <span>€{(invoice.vatAmount || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-gray-900 dark:text-gray-100">
                              <span>Totaal:</span>
                              <span>€{invoice.totalAmount.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Verzendinformatie */}
                      {(invoice.sentAt || invoice.deliveryStatus) && (
                        <div className="bg-white dark:bg-gray-800 rounded p-3 text-xs space-y-1.5">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Verzendinformatie</p>
                          {invoice.sentAt && (
                            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                              <Send className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>Verstuurd op: <span className="font-medium text-gray-900 dark:text-gray-100">{invoice.sentAt.toLocaleString('nl-NL')}</span></span>
                            </div>
                          )}
                          {invoice.deliveryStatus === 'pending' && (
                            <div className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-500">
                              <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" />
                              <span>Bezorging wacht op bevestiging van Make.com</span>
                            </div>
                          )}
                          {invoice.deliveryStatus === 'delivered' && (
                            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
                              <MailCheck className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>E-mail bezorgd{invoice.deliveredAt ? ` op ${invoice.deliveredAt.toLocaleString('nl-NL')}` : ''}</span>
                            </div>
                          )}
                          {invoice.deliveryStatus === 'failed' && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-red-600 dark:text-red-500">
                                <MailX className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="font-medium">E-mail bezorging mislukt</span>
                              </div>
                              {invoice.deliveryError && (
                                <p className="text-red-500 dark:text-red-400 pl-5">{invoice.deliveryError}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {!isReadOnly && (
                        <div className="flex gap-1.5 flex-wrap text-xs">
                          <Button
                            onClick={() => handleDuplicateInvoice(invoice)}
                            variant="secondary"
                            size="sm"
                            icon={Copy}
                            className="flex-1"
                            title="Kopieer naar nieuw concept"
                          >
                            Dupliceer
                          </Button>

                          <Button
                            onClick={() => handleEdit(invoice)}
                            variant="secondary"
                            size="sm"
                            icon={Edit}
                            className="flex-1"
                          >
                            Bewerk
                          </Button>

                          {invoice.status === 'draft' && (
                            <Button
                              onClick={() => handleSendInvoice(invoice.id!)}
                              disabled={isLoading}
                              size="sm"
                              icon={Send}
                              className="flex-1"
                            >
                              {isLoading ? '...' : 'Verstuur'}
                            </Button>
                          )}

                          {invoice.status === 'sent' && (
                            <Button
                              onClick={() => handleMarkAsPaid(invoice.id!)}
                              size="sm"
                              icon={CheckCircle}
                              className="flex-1"
                            >
                              Betaald
                            </Button>
                          )}

                          {invoice.status === 'draft' && (
                            <Button
                              onClick={() => handleDeleteInvoice(invoice.id!)}
                              variant="danger"
                              size="sm"
                              icon={Trash2}
                              className="flex-1"
                            >
                              Verwijder
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Compact Summary Footer */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs">
            <div>
              <p className="text-gray-600 dark:text-gray-300 font-medium">Excl. BTW</p>
              <p className="font-bold text-gray-900 dark:text-gray-100">€{totalExclBtw.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-300 font-medium">BTW</p>
              <p className="font-bold text-gray-900 dark:text-gray-100">€{totalVatAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-300 font-medium">Totaal incl.</p>
              <p className="font-bold text-gray-900 dark:text-gray-100">€{totalAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-300 font-medium">Concept</p>
              <p className="font-bold text-gray-900 dark:text-gray-100">{draftCount}</p>
            </div>
            <div>
              <p className="text-primary-600 font-medium">Verstuurd</p>
              <p className="font-bold text-primary-600">{sentCount}</p>
            </div>
            <div>
              <p className="text-green-600 font-medium">Betaald</p>
              <p className="font-bold text-green-600">{paidCount}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OutgoingInvoices;