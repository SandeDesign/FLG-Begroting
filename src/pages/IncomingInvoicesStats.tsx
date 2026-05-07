import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Search,
  Download,
  Edit2,
  Trash2,
  ArrowDownLeft,
  TrendingUp,
  X,
  Mail,
  RotateCw,
  MoreVertical,
  Upload,
  Filter
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import { usePageTitle } from '../contexts/PageTitleContext';
import { isInQuarter } from '../utils/dateFilters';
import ActionMenu from '../components/ui/ActionMenu';
import {
  incomingInvoiceService,
  IncomingInvoice,
} from '../services/incomingInvoiceService';
import { doc, updateDoc, deleteDoc, Timestamp, deleteField, addDoc, collection, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { generateIncomingInvoiceReference } from '../services/incomingInvoiceService';
import { extractWithClaudeVisionUrl } from '../services/ocrService';
import { supplierService } from '../services/supplierService';

const IncomingInvoicesStats: React.FC = () => {
  const { user, adminUserId, userRole } = useAuth();
  const { selectedCompany, selectedYear, selectedQuarter, queryUserId } = useApp();
  const { success, error: showError } = useToast();
  usePageTitle('Inkoopbonnen');

  // ✅ Role-based permissions
  const isAdmin = userRole === 'admin' || userRole === 'co-admin';
  const isManager = userRole === 'manager';
  const isBoekhouder = userRole === 'boekhouder';
  // Boekhouder leest alleen mee (geen mutaties)
  const canEdit = isAdmin || isManager;
  // Data-queries moeten altijd onder de admin-namespace gebeuren
  const dataUserId = queryUserId || selectedCompany?.userId || adminUserId;

  const [invoices, setInvoices] = useState<IncomingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<IncomingInvoice | null>(null);
  const [editFormData, setEditFormData] = useState<IncomingInvoice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isFetchingFromEmail, setIsFetchingFromEmail] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; invoice: IncomingInvoice } | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Load Invoices from Firestore
  const loadInvoices = useCallback(async () => {
    if (!user || !dataUserId || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await incomingInvoiceService.getInvoices(
        dataUserId,
        selectedCompany.id
      );
      setInvoices(data);
    } catch (err) {
      showError('Kon facturen niet laden');
      console.error('Error loading invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [user, dataUserId, selectedCompany, showError]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Period-filtered invoices
  const periodInvoices = invoices.filter(inv => {
    const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
    return isInQuarter(invDate, selectedYear, selectedQuarter);
  });

  // Filter and Sort
  const filteredInvoices = periodInvoices
    .filter(invoice => {
      const matchesSearch =
        invoice.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || invoice.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.totalAmount - a.totalAmount;
        case 'status':
          return a.status.localeCompare(b.status);
        case 'date':
        default:
          return new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
      }
    });

  // Statistics (based on period-filtered data)
  const statistics = {
    total: periodInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
    pending: periodInvoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.totalAmount, 0),
    approved: periodInvoices.filter(inv => inv.status === 'approved').reduce((sum, inv) => sum + inv.totalAmount, 0),
    paid: periodInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.totalAmount, 0),
    count: periodInvoices.length,
    pendingCount: periodInvoices.filter(inv => inv.status === 'pending').length,
    approvedCount: periodInvoices.filter(inv => inv.status === 'approved').length,
    paidCount: periodInvoices.filter(inv => inv.status === 'paid').length,
  };

  // Status Badge
  const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock, label: 'In behandeling' },
      approved: { bg: 'bg-primary-100', text: 'text-primary-800', icon: CheckCircle, label: 'Goedgekeurd' },
      paid: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle, label: 'Betaald' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle, label: 'Afgewezen' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${config.bg} ${config.text} text-sm font-medium`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </div>
    );
  };

  // Handle Approve
  const handleApprove = async (invoice: IncomingInvoice) => {
    if (!user || !adminUserId || !adminUserId) return;

    try {
      setIsSaving(true);
      const invoiceRef = doc(db, 'incomingInvoices', invoice.id!);
      await updateDoc(invoiceRef, {
        status: 'approved',
        approvedAt: Timestamp.fromDate(new Date()),
        approvedBy: adminUserId,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      // Leverancier toevoegen/bijwerken in suppliers collectie
      try {
        await supplierService.upsertSupplier(
          invoice.companyId,
          invoice.supplierName,
          invoice.supplierEmail || undefined,
          {
            amount: invoice.amount,
            vatAmount: invoice.vatAmount,
            totalAmount: invoice.totalAmount,
            invoiceDate: invoice.invoiceDate,
          }
        );
      } catch (supplierErr) {
        console.error('Supplier upsert failed:', supplierErr);
      }

      setInvoices(prev =>
        prev.map(inv =>
          inv.id === invoice.id
            ? {
              ...inv,
              status: 'approved',
              approvedAt: new Date(),
              approvedBy: adminUserId,
              updatedAt: new Date(),
            }
            : inv
        )
      );

      success('Factuur goedgekeurd');
    } catch (err) {
      showError('Kon factuur niet goedkeuren');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Mark as Paid
  const handleMarkPaid = async (invoice: IncomingInvoice) => {
    if (!user || !adminUserId || !adminUserId) return;

    try {
      setIsSaving(true);
      const invoiceRef = doc(db, 'incomingInvoices', invoice.id!);
      await updateDoc(invoiceRef, {
        status: 'paid',
        paidAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });

      setInvoices(prev =>
        prev.map(inv =>
          inv.id === invoice.id
            ? {
              ...inv,
              status: 'paid',
              paidAt: new Date(),
              updatedAt: new Date(),
            }
            : inv
        )
      );

      // ✅ Trigger webhook to Make.com when invoice is marked as paid
      try {
        console.log('📎 Invoice fileUrl:', invoice.fileUrl);
        console.log('📎 Full invoice object:', invoice);

        const webhookPayload = {
          event: 'incoming_invoice.paid',
          timestamp: new Date().toISOString(),
          invoice: {
            id: invoice.id,
            supplierName: invoice.supplierName,
            supplierEmail: invoice.supplierEmail || null,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amount,
            subtotal: (invoice as any).subtotal || invoice.amount,
            vatAmount: invoice.vatAmount,
            totalAmount: invoice.totalAmount,
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            description: invoice.description || '',
            status: 'paid',
            paidAt: new Date().toISOString(),
            // ✅ Include download link from internedata.nl
            fileUrl: invoice.fileUrl || null,
            driveWebLink: invoice.driveWebLink || null,
            fileName: invoice.fileName || null,
            ocrData: invoice.ocrData || null,
          },
          company: {
            id: selectedCompany?.id,
            name: selectedCompany?.name,
          },
          user: {
            id: user.uid,
            email: user.email,
          },
        };

        console.log('🚀 Sending webhook payload:', webhookPayload);

        await fetch('https://hook.eu2.make.com/8jntdat5emrvrcfgoq7giviwvtjx9nwt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
        });

        console.log('✅ Webhook triggered successfully for paid invoice:', invoice.id);
      } catch (webhookError) {
        console.error('⚠️ Webhook failed (non-critical):', webhookError);
        // Don't fail the whole operation if webhook fails
      }

      success('Factuur gemarkeerd als betaald');
    } catch (err) {
      showError('Kon factuur niet bijwerken');
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch invoices from email via Make.com webhook
  const handleFetchFromEmail = async () => {
    if (!user || !adminUserId || !selectedCompany) return;

    try {
      setIsFetchingFromEmail(true);

      const webhookPayload = {
        action: 'fetch_invoices_from_email',
        timestamp: new Date().toISOString(),
        company: {
          id: selectedCompany.id,
          name: selectedCompany.name,
        },
        user: {
          id: user.uid,
          email: user.email,
        },
      };

      const response = await fetch(
        'https://hook.eu2.make.com/sphpptl7j3x0aadqjidzb5r17uatkr5b',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        }
      );

      if (!response.ok) {
        throw new Error(`Webhook mislukt: ${response.status} ${response.statusText}`);
      }

      // Flexibel response parsen
      const contentType = response.headers.get('content-type');
      let data: any;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          if (text.toLowerCase().includes('accepted') || text === '202') {
            success('Verzoek verzonden', 'Make.com verwerkt je aanvraag. Facturen verschijnen zodra ze verwerkt zijn.');
            return;
          }
          throw new Error('Onverwacht antwoord van Make.com');
        }
      }

      // Normaliseer response: array, {invoices: [...]}, of {data: [...]}
      const invoicesFromEmail: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.invoices)
          ? data.invoices
          : Array.isArray(data?.data)
            ? data.data
            : [];

      if (invoicesFromEmail.length === 0) {
        success('Geen nieuwe facturen', 'Er zijn geen nieuwe facturen gevonden in de e-mail.');
        return;
      }

      // Sla elke factuur op in Firestore met correct referentienummer
      const now = new Date();
      let savedCount = 0;

      for (const emailInvoice of invoicesFromEmail) {
        try {
          const referenceNumber = await generateIncomingInvoiceReference(selectedCompany.id);

          // File info from Make.com (minimal: just URL, email, filename)
          const fileUrl = emailInvoice.fileUrl || emailInvoice.file_url || emailInvoice.bestandUrl || '';
          const supplierEmail = emailInvoice.supplierEmail || emailInvoice.supplier_email || emailInvoice.email || '';
          const originalFileName = emailInvoice.fileName || emailInvoice.file_name || emailInvoice.bestandsnaam || '';
          const fileExtension = originalFileName ? originalFileName.split('.').pop() : 'pdf';

          // Use Claude Vision to extract invoice data from the file
          let visionData = fileUrl ? await extractWithClaudeVisionUrl(fileUrl) : null;

          // Use extracted data if available, otherwise fall back to Make.com data
          const supplierName = visionData?.supplierName || emailInvoice.supplierName || emailInvoice.supplier_name || emailInvoice.leverancier || 'Onbekend';
          const subtotal = visionData?.subtotal || parseFloat(emailInvoice.subtotal || emailInvoice.amount || emailInvoice.bedrag || 0);
          const vatAmount = visionData?.vatAmount || parseFloat(emailInvoice.vatAmount || emailInvoice.vat_amount || emailInvoice.btw || 0);
          const totalAmount = visionData?.totalInclVat || parseFloat(emailInvoice.totalAmount || emailInvoice.total_amount || emailInvoice.totaal || 0) || (subtotal + vatAmount);
          const supplierInvoiceNumber = visionData?.invoiceNumber || emailInvoice.invoiceNumber || emailInvoice.invoice_number || emailInvoice.factuurnummer || '';
          const description = visionData?.description || emailInvoice.description || emailInvoice.omschrijving || '';

          const invoiceDate = visionData?.invoiceDate || (emailInvoice.invoiceDate || emailInvoice.invoice_date || emailInvoice.factuurdatum ? new Date(emailInvoice.invoiceDate || emailInvoice.invoice_date || emailInvoice.factuurdatum) : null);
          const dueDate = emailInvoice.dueDate || emailInvoice.due_date || emailInvoice.vervaldatum;

          const invoiceData: any = {
            userId: adminUserId,
            companyId: selectedCompany.id,
            referenceNumber,
            invoiceNumber: referenceNumber,
            supplierInvoiceNumber,
            supplierName,
            supplierEmail,
            amount: subtotal,
            subtotal: subtotal,
            vatAmount: vatAmount,
            totalAmount: totalAmount,
            description,
            invoiceDate: Timestamp.fromDate(invoiceDate ? new Date(invoiceDate) : now),
            dueDate: Timestamp.fromDate(dueDate ? new Date(dueDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)),
            status: 'pending' as const,
            fileName: `${referenceNumber}.${fileExtension}`,
            fileUrl: fileUrl,
            ocrProcessed: !!visionData,
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
            source: 'email',
          };

          await addDoc(collection(db, 'incomingInvoices'), invoiceData);
          savedCount++;
        } catch (saveErr) {
          console.error('Fout bij opslaan e-mail factuur:', saveErr);
        }
      }

      if (savedCount > 0) {
        success(`${savedCount} facturen opgehaald`, `${savedCount} facturen succesvol opgehaald uit e-mail.`);
        await loadInvoices();
      } else {
        showError('Kon facturen niet opslaan');
      }
    } catch (err) {
      console.error('Error fetching invoices from email:', err);
      showError('Fout bij ophalen', err instanceof Error ? err.message : 'Kon facturen niet ophalen uit e-mail');
    } finally {
      setIsFetchingFromEmail(false);
    }
  };

  // Open Edit Modal
  const openEdit = (invoice: IncomingInvoice) => {
    setEditingInvoice(invoice);
    setEditFormData({ ...invoice });
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingInvoice || !editFormData || !editingInvoice.id) return;

    try {
      setIsSaving(true);
      console.log('💾 Saving invoice:', editingInvoice.id);
      console.log('📝 Edit data:', editFormData);
      const invoiceRef = doc(db, 'incomingInvoices', editingInvoice.id);

      const updateData: any = {
        supplierName: editFormData.supplierName || '',
        invoiceNumber: editFormData.invoiceNumber || '',
        subtotal: editFormData.subtotal || editFormData.amount || 0,
        amount: editFormData.subtotal || editFormData.amount || 0,
        vatAmount: editFormData.vatAmount || 0,
        totalAmount: editFormData.totalAmount || 0,
        description: editFormData.description || '',
        status: editFormData.status || 'pending',
        invoiceDate: Timestamp.fromDate(
          editFormData.invoiceDate instanceof Date
            ? editFormData.invoiceDate
            : new Date(editFormData.invoiceDate)
        ),
        dueDate: Timestamp.fromDate(
          editFormData.dueDate instanceof Date
            ? editFormData.dueDate
            : new Date(editFormData.dueDate)
        ),
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Add optional fields only if they have values
      if (editFormData.supplierEmail) {
        updateData.supplierEmail = editFormData.supplierEmail;
      }

      // Clear status-specific timestamps if status is changed
      if (editFormData.status !== editingInvoice.status) {
        if (editFormData.status === 'pending') {
          updateData.approvedAt = deleteField();
          updateData.approvedBy = deleteField();
          updateData.paidAt = deleteField();
          updateData.rejectedAt = deleteField();
          updateData.rejectionReason = deleteField();
        } else if (editFormData.status === 'approved') {
          updateData.paidAt = deleteField();
          updateData.rejectedAt = deleteField();
          updateData.rejectionReason = deleteField();
          if (!editingInvoice.approvedAt) {
            updateData.approvedAt = Timestamp.fromDate(new Date());
            updateData.approvedBy = adminUserId;
          }
        } else if (editFormData.status === 'rejected') {
          updateData.approvedAt = deleteField();
          updateData.approvedBy = deleteField();
          updateData.paidAt = deleteField();
          if (!editingInvoice.rejectedAt) {
            updateData.rejectedAt = Timestamp.fromDate(new Date());
          }
        }
      }

      console.log('📤 Sending update to Firestore:', updateData);
      await updateDoc(invoiceRef, updateData);
      console.log('✅ Update successful, reloading invoices...');

      // Reload invoices from Firestore to ensure we have the latest data
      await loadInvoices();
      console.log('✅ Invoices reloaded');

      success('Factuur bijgewerkt');
      setEditingInvoice(null);
      setEditFormData(null);
    } catch (err) {
      console.error('❌ Error saving invoice:', err);
      showError('Kon factuur niet bijwerken');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Invoice
  const handleDelete = async (invoiceId: string) => {
    if (!window.confirm('Weet je zeker dat je deze factuur wilt verwijderen?')) return;

    try {
      setIsDeleting(invoiceId);

      // Find the invoice to get its reference number and companyId
      const invoice = invoices.find(inv => inv.id === invoiceId);
      const invoiceRef = doc(db, 'incomingInvoices', invoiceId);
      await deleteDoc(invoiceRef);

      // Try to decrement the counter if this was the last reference number
      const refNum = invoice?.invoiceNumber || (invoice as any)?.referenceNumber;
      if (refNum && invoice?.companyId) {
        try {
          const match = refNum.match(/^INK-(\d{4})-(\d+)$/);
          if (match) {
            const refYear = parseInt(match[1]);
            const refNumber = parseInt(match[2]);
            const counterRef = doc(db, 'companies', invoice.companyId, 'counters', 'incomingInvoices');

            await runTransaction(db, async (transaction) => {
              const counterDoc = await transaction.get(counterRef);
              if (counterDoc.exists()) {
                const data = counterDoc.data();
                // Only decrement if this was the last number (counter.number - 1 === refNumber)
                if (data.year === refYear && data.number - 1 === refNumber) {
                  transaction.update(counterRef, {
                    number: refNumber,
                    lastUpdated: Timestamp.now(),
                  });
                }
              }
            });
          }
        } catch (counterErr) {
          console.error('Counter decrement failed (non-critical):', counterErr);
        }
      }

      setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
      success('Factuur verwijderd');
    } catch (err) {
      showError('Kon factuur niet verwijderen');
    } finally {
      setIsDeleting(null);
    }
  };

  // Reprocess OCR for invoices with missing data
  const [reprocessingOCR, setReprocessingOCR] = useState<string | null>(null);
  const handleReprocessOCR = async (invoice: IncomingInvoice) => {
    if (!invoice.id || !invoice.fileUrl) return;

    try {
      setReprocessingOCR(invoice.id);
      const visionData = await extractWithClaudeVisionUrl(invoice.fileUrl);

      if (!visionData || (visionData.supplierName === 'Onbekend' && visionData.amount === 0)) {
        showError('OCR mislukt', 'Kon geen data uit het document halen');
        return;
      }

      const invoiceRef = doc(db, 'incomingInvoices', invoice.id);
      await updateDoc(invoiceRef, {
        supplierName: visionData.supplierName || invoice.supplierName,
        supplierInvoiceNumber: visionData.invoiceNumber || invoice.invoiceNumber,
        subtotal: visionData.subtotal || invoice.amount,
        amount: visionData.subtotal || invoice.amount,
        vatAmount: visionData.vatAmount || invoice.vatAmount,
        totalAmount: visionData.totalInclVat || invoice.totalAmount,
        description: visionData.description || invoice.description,
        invoiceDate: visionData.invoiceDate ? Timestamp.fromDate(new Date(visionData.invoiceDate)) : undefined,
        ocrProcessed: true,
        updatedAt: Timestamp.fromDate(new Date()),
      });

      await loadInvoices();
      success('OCR voltooid', `Leverancier: ${visionData.supplierName}, Bedrag: €${visionData.totalInclVat?.toFixed(2)}`);
    } catch (err) {
      console.error('OCR reprocess error:', err);
      showError('OCR fout', err instanceof Error ? err.message : 'OCR verwerking mislukt');
    } finally {
      setReprocessingOCR(null);
    }
  };

  // Download
  const handleDownload = (invoice: IncomingInvoice) => {
    const url = invoice.fileUrl || invoice.driveWebLink;
    if (url) {
      window.open(url, '_blank');
    } else {
      showError('Download niet beschikbaar');
    }
  };

  // Close context menu on outside click or scroll
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, invoice: IncomingInvoice) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, invoice });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('nl-NL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Inkoop Bonnen
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Controleer alle inkoop bonnen.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1 sm:mr-2" />
            Filter
          </Button>
          {(isAdmin || isManager) && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowUploadModal(true)}
              >
                <Upload className="w-4 h-4 mr-1 sm:mr-2" />
                Uploaden
              </Button>
              <Button
                size="sm"
                onClick={handleFetchFromEmail}
                loading={isFetchingFromEmail}
                disabled={isFetchingFromEmail || !selectedCompany}
              >
                <Mail className="w-4 h-4 mr-1 sm:mr-2" />
                Mail
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Zoeken op leverancier, factuurnummer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Alle statussen</option>
              <option value="pending">In behandeling</option>
              <option value="approved">Goedgekeurd</option>
              <option value="paid">Betaald</option>
              <option value="rejected">Afgewezen</option>
            </select>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="date">Sorteer op datum</option>
              <option value="amount">Sorteer op bedrag</option>
              <option value="status">Sorteer op status</option>
            </select>
          </div>
        </Card>
      )}

      {/* Table */}
      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="Geen facturen gevonden"
          description="Er zijn nog geen inkomende facturen"
        />
      ) : (
        <>
        {/* Desktop Table */}
        <Card className="overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Leverancier</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Factuurnummer</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Bedrag</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Datum</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Status</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredInvoices.map(invoice => (
                  <React.Fragment key={invoice.id}>
                    <tr
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 transition-colors cursor-pointer select-none"
                      onClick={() => setExpandedRow(expandedRow === invoice.id ? null : invoice.id)}
                      onContextMenu={(e) => handleContextMenu(e, invoice)}
                    >
                      <td className="px-6 py-4 text-gray-900 dark:text-gray-100 font-medium">
                        {invoice.supplierName}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-gray-100 font-semibold">
                        {formatCurrency(invoice.totalAmount)}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {formatDate(invoice.invoiceDate)}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setContextMenu({ x: e.currentTarget.getBoundingClientRect().right, y: e.currentTarget.getBoundingClientRect().bottom, invoice });
                          }}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Acties"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                        </button>
                      </td>
                    </tr>

                    {expandedRow === invoice.id && (
                      <tr className="bg-gray-50 dark:bg-gray-900">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-300">Beschrijving</p>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  {invoice.description}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-300">E-mail</p>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  {invoice.supplierEmail || '-'}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-300">Vervaldatum</p>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  {formatDate(invoice.dueDate)}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-600 dark:text-gray-300">Excl. BTW</p>
                                <p className="font-bold text-gray-900 dark:text-gray-100">
                                  {formatCurrency((invoice as any).subtotal || invoice.amount || 0)}
                                </p>
                              </div>
                              <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-600 dark:text-gray-300">BTW</p>
                                <p className="font-bold text-gray-900 dark:text-gray-100">
                                  {formatCurrency(invoice.vatAmount)}
                                </p>
                              </div>
                              <div className="bg-primary-50 p-3 rounded border border-primary-200">
                                <p className="text-xs text-primary-600">Incl. BTW</p>
                                <p className="font-bold text-primary-900">
                                  {formatCurrency(invoice.totalAmount)}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={Download}
                                onClick={() => handleDownload(invoice)}
                              >
                                Download
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {filteredInvoices.map(invoice => (
            <div
              key={invoice.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              onClick={() => setExpandedRow(expandedRow === invoice.id ? null : invoice.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {invoice.supplierName}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-300 mt-0.5">
                    {invoice.invoiceNumber}
                  </p>
                </div>
                <ActionMenu
                  actions={[
                    {
                      label: 'Bewerken',
                      icon: Edit2,
                      onClick: () => openEdit(invoice),
                    },
                    ...(isAdmin && invoice.status === 'pending'
                      ? [{
                          label: 'Goedkeuren',
                          icon: CheckCircle,
                          onClick: () => handleApprove(invoice),
                        }]
                      : []),
                    ...(isAdmin && (invoice.status === 'approved' || invoice.status === 'pending')
                      ? [{
                          label: 'Markeer als betaald',
                          icon: ArrowDownLeft,
                          onClick: () => handleMarkPaid(invoice),
                        }]
                      : []),
                    ...(invoice.fileUrl || (invoice as any).driveWebLink
                      ? [{
                          label: 'Download',
                          icon: Download,
                          onClick: () => handleDownload(invoice),
                        }]
                      : []),
                    ...(isAdmin
                      ? [{
                          label: 'Verwijderen',
                          icon: Trash2,
                          onClick: () => handleDelete(invoice.id!),
                          variant: 'danger' as const,
                        }]
                      : []),
                  ]}
                />
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-gray-500 dark:text-gray-300">
                  {formatDate(invoice.invoiceDate)}
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(invoice.totalAmount)}
                </span>
              </div>

              <div className="mt-2">
                <StatusBadge status={invoice.status} />
              </div>

              {expandedRow === invoice.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-300">Beschrijving</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {invoice.description}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-300">E-mail</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {invoice.supplierEmail || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-300">Vervaldatum</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-300">Excl. BTW</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency((invoice as any).subtotal || invoice.amount || 0)}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-300">BTW</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(invoice.vatAmount)}
                      </p>
                    </div>
                    <div className="bg-primary-50 p-2 rounded border border-primary-200">
                      <p className="text-xs text-primary-600">Incl. BTW</p>
                      <p className="text-sm font-bold text-primary-900">
                        {formatCurrency(invoice.totalAmount)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        </>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: 'Totaal',
            amount: statistics.total,
            count: statistics.count,
            icon: TrendingUp,
            color: 'bg-gradient-to-br from-primary-500 to-primary-600',
          },
          {
            label: 'In Behandeling',
            amount: statistics.pending,
            count: statistics.pendingCount,
            icon: Clock,
            color: 'bg-gradient-to-br from-yellow-500 to-yellow-600',
          },
          {
            label: 'Goedgekeurd',
            amount: statistics.approved,
            count: statistics.approvedCount,
            icon: CheckCircle,
            color: 'bg-gradient-to-br from-primary-500 to-cyan-600',
          },
          {
            label: 'Betaald',
            amount: statistics.paid,
            count: statistics.paidCount,
            icon: CheckCircle,
            color: 'bg-gradient-to-br from-green-500 to-emerald-600',
          },
        ].map((stat, index) => (
          <Card key={index} className="overflow-hidden">
            <div className={`${stat.color} p-4 text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-90">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(stat.amount)}</p>
                  <p className="text-xs opacity-75 mt-2">{stat.count} facturen</p>
                </div>
                <stat.icon className="w-12 h-12 opacity-20" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Edit Modal */}
      {editingInvoice && editFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Factuur bewerken</h2>
              <button
                onClick={() => {
                  setEditingInvoice(null);
                  setEditFormData(null);
                }}
                className="text-gray-500 dark:text-gray-300 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Status Selector - Only for admins */}
              {isAdmin && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Status
                  </label>
                  <select
                    value={editFormData.status ?? 'pending'}
                    onChange={e => setEditFormData({ ...editFormData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  >
                    <option value="pending">In behandeling (Concept)</option>
                    <option value="approved">Goedgekeurd</option>
                    <option value="paid">Betaald</option>
                    <option value="rejected">Afgewezen</option>
                  </select>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                    ℹ️ Je kunt de status aanpassen om bonnen terug te zetten (bijv. van betaald naar concept voor testen)
                  </p>
                </div>
              )}

              {/* Status Display - For managers (read-only) */}
              {isManager && (
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Status (alleen-lezen)
                  </label>
                  <div className="mt-2">
                    <StatusBadge status={editFormData.status ?? 'pending'} />
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                    ℹ️ Alleen admins kunnen de status wijzigen
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Leverancier
                  </label>
                  <input
                    type="text"
                    value={editFormData.supplierName ?? ''}
                    onChange={e => setEditFormData({ ...editFormData, supplierName: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Factuurnummer
                  </label>
                  <input
                    type="text"
                    value={editFormData.invoiceNumber ?? ''}
                    onChange={e => setEditFormData({ ...editFormData, invoiceNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Excl. BTW (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={(editFormData as any).subtotal ?? editFormData.amount ?? ''}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditFormData({ ...editFormData, subtotal: val, amount: val } as IncomingInvoice);
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    BTW (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.vatAmount ?? ''}
                    onChange={e => setEditFormData({ ...editFormData, vatAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Incl. BTW (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.totalAmount ?? ''}
                    onChange={e => setEditFormData({ ...editFormData, totalAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={editFormData.supplierEmail ?? ''}
                    onChange={e => setEditFormData({ ...editFormData, supplierEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Factuurdatum
                  </label>
                  <input
                    type="date"
                    value={
                      editFormData.invoiceDate
                        ? new Date(editFormData.invoiceDate).toISOString().split('T')[0]
                        : ''
                    }
                    onChange={e => setEditFormData({ ...editFormData, invoiceDate: new Date(e.target.value) })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Vervaldatum
                  </label>
                  <input
                    type="date"
                    value={
                      editFormData.dueDate
                        ? new Date(editFormData.dueDate).toISOString().split('T')[0]
                        : ''
                    }
                    onChange={e => setEditFormData({ ...editFormData, dueDate: new Date(e.target.value) })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Beschrijving
                </label>
                <textarea
                  value={editFormData.description ?? ''}
                  onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Preview</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white dark:bg-gray-800 p-3 rounded">
                    <p className="text-xs text-gray-600 dark:text-gray-300">Excl. BTW</p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency((editFormData as any).subtotal || editFormData.amount || 0)}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded">
                    <p className="text-xs text-gray-600 dark:text-gray-300">BTW</p>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency(editFormData.vatAmount || 0)}
                    </p>
                  </div>
                  <div className="bg-primary-50 dark:bg-primary-900/30 p-3 rounded">
                    <p className="text-xs text-primary-600 dark:text-primary-400">Incl. BTW</p>
                    <p className="font-bold text-primary-900 dark:text-primary-100">
                      {formatCurrency(editFormData.totalAmount || 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingInvoice(null);
                  setEditFormData(null);
                }}
              >
                Annuleren
              </Button>
              <Button
                onClick={handleSaveEdit}
                loading={isSaving}
              >
                Opslaan
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[200px]"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 220),
            top: Math.min(contextMenu.y, window.innerHeight - 300),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Bewerken - iedereen */}
          <button
            onClick={() => { openEdit(contextMenu.invoice); setContextMenu(null); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Edit2 className="w-4 h-4 text-primary-600" />
            Bewerken
          </button>

          {/* Goedkeuren - admin, pending */}
          {isAdmin && contextMenu.invoice.status === 'pending' && (
            <button
              onClick={() => { handleApprove(contextMenu.invoice); setContextMenu(null); }}
              disabled={isSaving}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4 text-green-600" />
              Goedkeuren
            </button>
          )}

          {/* Betaald markeren - admin, pending/approved */}
          {isAdmin && (contextMenu.invoice.status === 'approved' || contextMenu.invoice.status === 'pending') && (
            <button
              onClick={() => { handleMarkPaid(contextMenu.invoice); setContextMenu(null); }}
              disabled={isSaving}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              Markeer als betaald
            </button>
          )}

          {/* Opnieuw OCR - admin, onvolledige data */}
          {isAdmin && contextMenu.invoice.fileUrl && (contextMenu.invoice.supplierName === 'Onbekend' || contextMenu.invoice.totalAmount === 0) && (
            <button
              onClick={() => { handleReprocessOCR(contextMenu.invoice); setContextMenu(null); }}
              disabled={reprocessingOCR === contextMenu.invoice.id}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 text-purple-600 ${reprocessingOCR === contextMenu.invoice.id ? 'animate-spin' : ''}`} />
              Opnieuw OCR verwerken
            </button>
          )}

          {/* Download - als fileUrl beschikbaar */}
          {(contextMenu.invoice.fileUrl || (contextMenu.invoice as any).driveWebLink) && (
            <button
              onClick={() => { handleDownload(contextMenu.invoice); setContextMenu(null); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4 text-gray-600" />
              Download
            </button>
          )}

          {/* Verwijderen - admin */}
          {isAdmin && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
              <button
                onClick={() => { handleDelete(contextMenu.invoice.id!); setContextMenu(null); }}
                disabled={isDeleting === contextMenu.invoice.id}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Verwijderen
              </button>
            </>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Factuur uploaden</h2>
              <button
                onClick={() => { setShowUploadModal(false); loadInvoices(); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <iframe
              src={`/upload?tab=facturen&embed=true${selectedCompany ? `&companyId=${selectedCompany.id}` : ''}`}
              className="flex-1 w-full border-0"
              title="Factuur uploaden"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default IncomingInvoicesStats;