import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, CreditCard as Edit, Trash2, Mail, Phone, MapPin, Building2, X, Users, Truck, FileText, Euro, ChevronRight, Globe, Hash } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import { collection, addDoc, getDocs, query, where, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { supplierService } from '../services/supplierService';
import { Supplier, Grootboekrekening } from '../types/supplier';
import { IncomingInvoice } from '../services/incomingInvoiceService';
import { usePageTitle } from '../contexts/PageTitleContext';

export interface InvoiceRelation {
  id?: string;
  userId: string;
  companyId: string;
  name: string;
  email: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
  taxNumber?: string;
  kvk?: string;
  website?: string;
  notes?: string;
  defaultAdditionalRecipients?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const COLLECTION_NAME = 'invoiceRelations';

type TabType = 'klanten' | 'leveranciers';

const InvoiceRelations: React.FC = () => {
  const { user } = useAuth();
  const { selectedCompany, queryUserId } = useApp();
  const { success, error: showError } = useToast();
  usePageTitle('Klanten & Leveranciers');

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('klanten');

  // Klanten state
  const [relations, setRelations] = useState<InvoiceRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRelation, setEditingRelation] = useState<InvoiceRelation | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<InvoiceRelation>>({
    name: '',
    email: '',
    phone: '',
    address: { street: '', city: '', zipCode: '', country: 'Nederland' },
    taxNumber: '',
    kvk: '',
    website: '',
    notes: '',
    defaultAdditionalRecipients: []
  });
  const [newDefaultRecipient, setNewDefaultRecipient] = useState('');

  // Klant detail modal state
  const [selectedCustomer, setSelectedCustomer] = useState<InvoiceRelation | null>(null);
  const [showCustomerDetailModal, setShowCustomerDetailModal] = useState(false);

  // Leveranciers state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierInvoices, setSupplierInvoices] = useState<IncomingInvoice[]>([]);
  const [supplierInvoicesLoading, setSupplierInvoicesLoading] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  // Grootboek state
  const [grootboekrekeningen, setGrootboekrekeningen] = useState<Grootboekrekening[]>([]);
  const [showGrootboekForm, setShowGrootboekForm] = useState(false);
  const [newGrootboekCode, setNewGrootboekCode] = useState('');
  const [newGrootboekName, setNewGrootboekName] = useState('');
  const [newGrootboekCategory, setNewGrootboekCategory] = useState('kosten');

  // Load klanten
  const loadRelations = useCallback(async () => {
    if (!user || !selectedCompany || !queryUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', queryUserId),
        where('companyId', '==', selectedCompany.id)
      );

      const querySnapshot = await getDocs(q);
      const relationsData = querySnapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as InvoiceRelation;
      });

      setRelations(relationsData);
    } catch (error) {
      console.error('Error loading relations:', error);
      showError('Fout bij laden', 'Kon relaties niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, queryUserId, showError]);

  // Load leveranciers
  const loadSuppliers = useCallback(async () => {
    if (!selectedCompany) {
      setSuppliersLoading(false);
      return;
    }

    try {
      setSuppliersLoading(true);
      const data = await supplierService.getSuppliers(selectedCompany.id);
      setSuppliers(data);

      const gbData = await supplierService.getGrootboekrekeningen(selectedCompany.id);
      setGrootboekrekeningen(gbData);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      showError('Fout bij laden', 'Kon leveranciers niet laden');
    } finally {
      setSuppliersLoading(false);
    }
  }, [selectedCompany, showError]);

  // Load supplier invoices when detail modal opens
  const loadSupplierInvoices = useCallback(async (supplier: Supplier) => {
    if (!selectedCompany) return;

    try {
      setSupplierInvoicesLoading(true);
      const q = query(
        collection(db, 'incomingInvoices'),
        where('companyId', '==', selectedCompany.id),
        where('supplierName', '==', supplier.supplierName)
      );

      const snapshot = await getDocs(q);
      const invoices = snapshot.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            invoiceDate: data.invoiceDate?.toDate?.() || new Date(),
            dueDate: data.dueDate?.toDate?.() || new Date(),
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
            approvedAt: data.approvedAt?.toDate?.() || undefined,
            paidAt: data.paidAt?.toDate?.() || undefined,
          } as IncomingInvoice;
        })
        .filter(inv => inv.status === 'approved' || inv.status === 'paid')
        .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());

      setSupplierInvoices(invoices);
    } catch (error) {
      console.error('Error loading supplier invoices:', error);
    } finally {
      setSupplierInvoicesLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    loadRelations();
  }, [loadRelations]);

  useEffect(() => {
    if (activeTab === 'leveranciers') {
      loadSuppliers();
    }
  }, [activeTab, loadSuppliers]);

  // Klanten handlers
  const handleCreate = () => {
    setEditingRelation(null);
    setFormData({
      name: '', email: '', phone: '',
      address: { street: '', city: '', zipCode: '', country: 'Nederland' },
      taxNumber: '', kvk: '', website: '', notes: '', defaultAdditionalRecipients: []
    });
    setNewDefaultRecipient('');
    setIsModalOpen(true);
  };

  const handleEdit = (relation: InvoiceRelation) => {
    setEditingRelation(relation);
    setFormData(relation);
    setNewDefaultRecipient('');
    setIsModalOpen(true);
  };

  const addDefaultRecipient = () => {
    const email = newDefaultRecipient.trim();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const currentRecipients = formData.defaultAdditionalRecipients || [];
      if (!currentRecipients.includes(email)) {
        setFormData({ ...formData, defaultAdditionalRecipients: [...currentRecipients, email] });
        setNewDefaultRecipient('');
      } else {
        showError('Validatie fout', 'Dit email adres is al toegevoegd');
      }
    } else {
      showError('Validatie fout', 'Voer een geldig email adres in');
    }
  };

  const removeDefaultRecipient = (index: number) => {
    const currentRecipients = formData.defaultAdditionalRecipients || [];
    setFormData({ ...formData, defaultAdditionalRecipients: currentRecipients.filter((_, i) => i !== index) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompany || !queryUserId) {
      showError('Fout', 'Geen gebruiker of bedrijf geselecteerd');
      return;
    }
    if (!formData.name?.trim() || !formData.email?.trim()) {
      showError('Validatie fout', 'Naam en email zijn verplicht');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const relationData = {
        userId: queryUserId,
        companyId: selectedCompany.id,
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone?.trim() || '',
        address: formData.address || { street: '', city: '', zipCode: '', country: 'Nederland' },
        taxNumber: formData.taxNumber?.trim() || '',
        kvk: formData.kvk?.trim() || '',
        website: formData.website?.trim() || '',
        notes: formData.notes?.trim() || '',
        defaultAdditionalRecipients: formData.defaultAdditionalRecipients || [],
        updatedAt: Timestamp.fromDate(now)
      };

      if (editingRelation?.id) {
        await updateDoc(doc(db, COLLECTION_NAME, editingRelation.id), relationData);
        success('Relatie bijgewerkt', 'De relatie is succesvol bijgewerkt');
      } else {
        await addDoc(collection(db, COLLECTION_NAME), { ...relationData, createdAt: Timestamp.fromDate(now) });
        success('Relatie aangemaakt', 'De relatie is succesvol aangemaakt');
      }

      setIsModalOpen(false);
      loadRelations();
    } catch (error) {
      console.error('Error saving relation:', error);
      showError('Fout bij opslaan', 'Kon relatie niet opslaan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze relatie wilt verwijderen?')) return;
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
      success('Relatie verwijderd', 'De relatie is succesvol verwijderd');
      loadRelations();
    } catch (error) {
      console.error('Error deleting relation:', error);
      showError('Fout bij verwijderen', 'Kon relatie niet verwijderen');
    }
  };

  // Klant detail handler
  const openCustomerDetail = (customer: InvoiceRelation) => {
    setSelectedCustomer(customer);
    setShowCustomerDetailModal(true);
  };

  // Leverancier handlers
  const openSupplierDetail = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowSupplierModal(true);
    loadSupplierInvoices(supplier);
  };

  const handleUpdateGrootboek = async (supplierId: string, code: string, name: string) => {
    try {
      await supplierService.updateSupplierGrootboek(supplierId, code, name);
      success('Grootboekrekening gekoppeld');
      setSuppliers(prev => prev.map(s =>
        s.id === supplierId ? { ...s, grootboekrekening: code, grootboekrekeningName: name } : s
      ));
      if (selectedSupplier?.id === supplierId) {
        setSelectedSupplier(prev => prev ? { ...prev, grootboekrekening: code, grootboekrekeningName: name } : null);
      }
    } catch (error) {
      console.error('Error updating grootboek:', error);
      showError('Fout', 'Kon grootboekrekening niet koppelen');
    }
  };

  const handleAddGrootboek = async () => {
    if (!selectedCompany || !newGrootboekCode.trim() || !newGrootboekName.trim()) return;
    try {
      await supplierService.addGrootboekrekening(selectedCompany.id, newGrootboekCode.trim(), newGrootboekName.trim(), newGrootboekCategory);
      const updated = await supplierService.getGrootboekrekeningen(selectedCompany.id);
      setGrootboekrekeningen(updated);
      setNewGrootboekCode('');
      setNewGrootboekName('');
      setShowGrootboekForm(false);
      success('Grootboekrekening aangemaakt');
    } catch (error) {
      console.error('Error adding grootboek:', error);
      showError('Fout', 'Kon grootboekrekening niet aanmaken');
    }
  };

  const filteredRelations = relations.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter(s =>
    s.supplierName.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
    (s.supplierEmail || '').toLowerCase().includes(supplierSearchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);

  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  if (loading && suppliersLoading) {
    return <LoadingSpinner />;
  }

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Geen bedrijf geselecteerd"
        description="Selecteer een bedrijf om relaties te beheren"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Klanten & Leveranciers</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            Beheer klanten en leveranciers voor {selectedCompany.name}
          </p>
        </div>
        {activeTab === 'klanten' && (
          <Button onClick={handleCreate} className="mt-4 sm:mt-0 lg:mt-0" icon={Plus}>
            Nieuwe Klant
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 -mx-4 px-4 sm:mx-0 sm:px-0">
        <nav className="-mb-px flex gap-3 sm:gap-6 lg:gap-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('klanten')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'klanten'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            <Users className="h-4 w-4" />
            Klanten
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
              activeTab === 'klanten'
                ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}>
              {relations.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('leveranciers')}
            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'leveranciers'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            <Truck className="h-4 w-4" />
            Leveranciers
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
              activeTab === 'leveranciers'
                ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}>
              {suppliers.length}
            </span>
          </button>
        </nav>
      </div>

      {/* ===== TAB: KLANTEN ===== */}
      {activeTab === 'klanten' && (
        <>
          <Card>
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Zoek op naam of email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>
          </Card>

          {loading ? (
            <LoadingSpinner />
          ) : filteredRelations.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Geen klanten gevonden"
              description={searchTerm ? 'Geen klanten gevonden voor deze zoekterm' : 'Maak je eerste klant aan'}
              action={<Button onClick={handleCreate} icon={Plus}>Nieuwe Klant</Button>}
            />
          ) : (
            <>
              <Card className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Naam</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">Telefoon</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">KvK</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden xl:table-cell">Stad</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredRelations.map((relation) => (
                      <tr key={relation.id} onClick={() => openCustomerDetail(relation)} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mr-3">
                              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                                {relation.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{relation.name}</div>
                              {relation.taxNumber && (
                                <div className="text-xs text-gray-500 dark:text-gray-300">BTW: {relation.taxNumber}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                          {relation.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                          {relation.phone || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                          {relation.kvk || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 hidden xl:table-cell">
                          {relation.address?.city || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mobiele cards */}
            <div className="md:hidden space-y-3">
              {filteredRelations.map((relation) => (
                <Card key={relation.id} className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors" onClick={() => openCustomerDetail(relation)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0">
                      <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mr-3 flex-shrink-0">
                        <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                          {relation.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{relation.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-300 truncate">{relation.email}</div>
                        {relation.phone && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">{relation.phone}</div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                  </div>
                </Card>
              ))}
            </div>
            </>
          )}
        </>
      )}

      {/* ===== TAB: LEVERANCIERS ===== */}
      {activeTab === 'leveranciers' && (
        <>
          <Card>
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Zoek leverancier..."
                  value={supplierSearchTerm}
                  onChange={(e) => setSupplierSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>
          </Card>

          {/* Totaaloverzicht */}
          {suppliers.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <div className="p-4 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-300">Totaal leveranciers</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{suppliers.length}</p>
                </div>
              </Card>
              <Card>
                <div className="p-4 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-300">Totaal facturen</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {suppliers.reduce((sum, s) => sum + s.invoiceCount, 0)}
                  </p>
                </div>
              </Card>
              <Card>
                <div className="p-4 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-300">Totaal incl. BTW</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(suppliers.reduce((sum, s) => sum + s.totalAmountIncVat, 0))}
                  </p>
                </div>
              </Card>
            </div>
          )}

          {suppliersLoading ? (
            <LoadingSpinner />
          ) : filteredSuppliers.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="Geen leveranciers gevonden"
              description={supplierSearchTerm
                ? 'Geen leveranciers gevonden voor deze zoekterm'
                : 'Leveranciers worden automatisch aangemaakt wanneer je een inkoopbon goedkeurt'}
            />
          ) : (
            <>
              <Card className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Leverancier</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">Email</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Facturen</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">Excl. BTW</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Incl. BTW</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden xl:table-cell">Grootboek</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredSuppliers.map((supplier) => (
                      <tr
                        key={supplier.id}
                        onClick={() => openSupplierDetail(supplier)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mr-3">
                              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                {supplier.supplierName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{supplier.supplierName}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-300 lg:hidden">{supplier.supplierEmail || ''}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                          {supplier.supplierEmail || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                            {supplier.invoiceCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                          {formatCurrency(supplier.totalAmountExVat)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(supplier.totalAmountIncVat)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 hidden xl:table-cell">
                          {supplier.grootboekrekening
                            ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">{supplier.grootboekrekening} - {supplier.grootboekrekeningName}</span>
                            : <span className="text-gray-400 dark:text-gray-500 italic">Niet gekoppeld</span>
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mobiele leverancier cards */}
            <div className="md:hidden space-y-3">
              {filteredSuppliers.map((supplier) => (
                <Card key={supplier.id} className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors" onClick={() => openSupplierDetail(supplier)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mr-3 flex-shrink-0">
                        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                          {supplier.supplierName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{supplier.supplierName}</div>
                        {supplier.supplierEmail && (
                          <div className="text-xs text-gray-500 dark:text-gray-300 truncate">{supplier.supplierEmail}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                            {supplier.invoiceCount} facturen
                          </span>
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(supplier.totalAmountIncVat)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                  </div>
                </Card>
              ))}
            </div>
            </>
          )}
        </>
      )}

      {/* ===== KLANT DETAIL MODAL ===== */}
      <Modal isOpen={showCustomerDetailModal} onClose={() => setShowCustomerDetailModal(false)} title={selectedCustomer?.name || 'Klant'} size="xl">
        {selectedCustomer && (
          <div className="space-y-6">
            {/* Contact info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-3.5 w-3.5 text-gray-400" />
                  <p className="text-xs text-gray-500 dark:text-gray-300">Email</p>
                </div>
                <a href={`mailto:${selectedCustomer.email}`} className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline">{selectedCustomer.email}</a>
              </div>
              {selectedCustomer.phone && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    <p className="text-xs text-gray-500 dark:text-gray-300">Telefoon</p>
                  </div>
                  <a href={`tel:${selectedCustomer.phone}`} className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedCustomer.phone}</a>
                </div>
              )}
              {selectedCustomer.website && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="h-3.5 w-3.5 text-gray-400" />
                    <p className="text-xs text-gray-500 dark:text-gray-300">Website</p>
                  </div>
                  <a href={selectedCustomer.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline truncate block">{selectedCustomer.website}</a>
                </div>
              )}
            </div>

            {/* Bedrijfsgegevens */}
            {(selectedCustomer.kvk || selectedCustomer.taxNumber) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedCustomer.kvk && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Hash className="h-3.5 w-3.5 text-gray-400" />
                      <p className="text-xs text-gray-500 dark:text-gray-300">KvK Nummer</p>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedCustomer.kvk}</p>
                  </div>
                )}
                {selectedCustomer.taxNumber && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Euro className="h-3.5 w-3.5 text-gray-400" />
                      <p className="text-xs text-gray-500 dark:text-gray-300">BTW Nummer</p>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedCustomer.taxNumber}</p>
                  </div>
                )}
              </div>
            )}

            {/* Adres */}
            {selectedCustomer.address && (selectedCustomer.address.street || selectedCustomer.address.city) && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                  <p className="text-xs text-gray-500 dark:text-gray-300">Adres</p>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {[selectedCustomer.address.street, `${selectedCustomer.address.zipCode} ${selectedCustomer.address.city}`.trim(), selectedCustomer.address.country].filter(Boolean).join(', ')}
                </p>
              </div>
            )}

            {/* Notities */}
            {selectedCustomer.notes && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <p className="text-xs text-gray-500 dark:text-gray-300 mb-1">Notities</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedCustomer.notes}</p>
              </div>
            )}

            {/* Extra ontvangers */}
            {selectedCustomer.defaultAdditionalRecipients && selectedCustomer.defaultAdditionalRecipients.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <p className="text-xs text-gray-500 dark:text-gray-300 mb-2">Standaard extra ontvangers</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCustomer.defaultAdditionalRecipients.map((email, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300">
                      {email}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Acties */}
            <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <Button icon={Edit} onClick={() => { setShowCustomerDetailModal(false); handleEdit(selectedCustomer); }}>
                Bewerken
              </Button>
              <Button variant="danger" icon={Trash2} onClick={() => { setShowCustomerDetailModal(false); handleDelete(selectedCustomer.id!); }}>
                Verwijderen
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== KLANT FORM MODAL ===== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {editingRelation ? 'Klant Bewerken' : 'Nieuwe Klant'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="h-5 w-5 text-gray-500 dark:text-gray-300" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Naam / Bedrijf *</label>
                    <input type="text" required value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100" placeholder="Bedrijfsnaam" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Email *</label>
                    <input type="email" required value={formData.email || ''} onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100" placeholder="email@bedrijf.nl" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Telefoon</label>
                    <input type="tel" value={formData.phone || ''} onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100" placeholder="+31 6 12345678" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Website</label>
                    <input type="url" value={formData.website || ''} onChange={(e) => setFormData({...formData, website: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100" placeholder="https://example.com" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">KvK Nummer</label>
                    <input type="text" value={formData.kvk || ''} onChange={(e) => setFormData({...formData, kvk: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100" placeholder="12345678" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Belasting Nummer (VAT)</label>
                    <input type="text" value={formData.taxNumber || ''} onChange={(e) => setFormData({...formData, taxNumber: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100" placeholder="NL123456789B01" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Adres</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Straat</label>
                      <input type="text" value={formData.address?.street || ''} onChange={(e) => setFormData({...formData, address: {...formData.address, street: e.target.value}})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100" placeholder="Straat en huisnummer" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Postcode</label>
                        <input type="text" value={formData.address?.zipCode || ''} onChange={(e) => setFormData({...formData, address: {...formData.address, zipCode: e.target.value}})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100" placeholder="1234 AB" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Plaats</label>
                        <input type="text" value={formData.address?.city || ''} onChange={(e) => setFormData({...formData, address: {...formData.address, city: e.target.value}})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100" placeholder="Amsterdam" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Land</label>
                        <input type="text" value={formData.address?.country || 'Nederland'} onChange={(e) => setFormData({...formData, address: {...formData.address, country: e.target.value}})}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100" placeholder="Nederland" />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Notities</label>
                  <textarea value={formData.notes || ''} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100" placeholder="Interne notities..." />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Standaard extra ontvangers (optioneel)</label>
                  <p className="text-xs text-gray-500 dark:text-gray-300 mb-3">Deze email adressen ontvangen automatisch een kopie van elke factuur voor deze klant</p>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input type="email" value={newDefaultRecipient} onChange={(e) => setNewDefaultRecipient(e.target.value)}
                        onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDefaultRecipient(); } }}
                        placeholder="email@example.com"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100 text-sm" />
                      <Button type="button" onClick={addDefaultRecipient} size="sm" icon={Plus}>Toevoegen</Button>
                    </div>
                    {formData.defaultAdditionalRecipients && formData.defaultAdditionalRecipients.length > 0 && (
                      <div className="space-y-1">
                        {formData.defaultAdditionalRecipients.map((email, index) => (
                          <div key={index} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                            <span className="text-sm text-gray-700 dark:text-gray-300">{email}</span>
                            <button type="button" onClick={() => removeDefaultRecipient(index)} className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <Button type="button" variant="ghost" icon={X} onClick={() => setIsModalOpen(false)}>Annuleren</Button>
              <Button onClick={handleSubmit} disabled={isSaving} icon={editingRelation ? Edit : Plus}>
                {isSaving ? 'Opslaan...' : editingRelation ? 'Bijwerken' : 'Aanmaken'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== LEVERANCIER DETAIL MODAL ===== */}
      <Modal isOpen={showSupplierModal} onClose={() => setShowSupplierModal(false)} title={selectedSupplier?.supplierName || 'Leverancier'} size="xl">
        {selectedSupplier && (
          <div className="space-y-6">
            {/* Leverancier info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <p className="text-xs text-gray-500 dark:text-gray-300 mb-1">Email</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedSupplier.supplierEmail || '-'}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <p className="text-xs text-gray-500 dark:text-gray-300 mb-1">Laatste factuur</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDate(selectedSupplier.lastInvoiceDate)}</p>
              </div>
            </div>

            {/* Bedragen */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Excl. BTW</p>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(selectedSupplier.totalAmountExVat)}</p>
              </div>
              <div className="bg-orange-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">BTW</p>
                <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{formatCurrency(selectedSupplier.totalVatAmount)}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Totaal incl. BTW</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(selectedSupplier.totalAmountIncVat)}</p>
              </div>
            </div>

            {/* Grootboekrekening */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Grootboekrekening</p>
                {!showGrootboekForm && (
                  <button
                    onClick={() => setShowGrootboekForm(true)}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    + Nieuwe aanmaken
                  </button>
                )}
              </div>

              {showGrootboekForm && (
                <div className="mb-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text" placeholder="Code (bijv. 4100)" value={newGrootboekCode} onChange={(e) => setNewGrootboekCode(e.target.value)}
                      className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                    />
                    <input
                      type="text" placeholder="Naam" value={newGrootboekName} onChange={(e) => setNewGrootboekName(e.target.value)}
                      className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                    />
                    <select value={newGrootboekCategory} onChange={(e) => setNewGrootboekCategory(e.target.value)}
                      className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100">
                      <option value="kosten">Kosten</option>
                      <option value="omzet">Omzet</option>
                      <option value="balans">Balans</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddGrootboek}>Opslaan</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowGrootboekForm(false)}>Annuleren</Button>
                  </div>
                </div>
              )}

              <select
                value={selectedSupplier.grootboekrekening || ''}
                onChange={(e) => {
                  const selected = grootboekrekeningen.find(g => g.code === e.target.value);
                  if (selected && selectedSupplier.id) {
                    handleUpdateGrootboek(selectedSupplier.id, selected.code, selected.name);
                  }
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Selecteer grootboekrekening...</option>
                {grootboekrekeningen.map(g => (
                  <option key={g.id} value={g.code}>{g.code} - {g.name}</option>
                ))}
              </select>
            </div>

            {/* Inkoopbonnen */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Inkoopbonnen ({supplierInvoices.length})
              </h4>

              {supplierInvoicesLoading ? (
                <div className="flex justify-center py-4"><LoadingSpinner /></div>
              ) : supplierInvoices.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-300 text-center py-4">Geen inkoopbonnen gevonden</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Factuurnr.</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Datum</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">Excl. BTW</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">BTW</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300">Totaal</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {supplierInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                          <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{inv.invoiceNumber || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{formatDate(inv.invoiceDate)}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 text-right">{formatCurrency(inv.amount)}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 text-right">{formatCurrency(inv.vatAmount)}</td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 text-right">{formatCurrency(inv.totalAmount)}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              inv.status === 'paid'
                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            }`}>
                              {inv.status === 'paid' ? 'Betaald' : 'Goedgekeurd'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InvoiceRelations;
