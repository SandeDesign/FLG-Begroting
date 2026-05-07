import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp,
  Shield,
  Edit2,
  Save,
  Link,
  Search,
  RefreshCw,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Users,
  Download,
  UserPlus,
  Tag,
  CheckSquare,
  Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import { bankImportService } from '../services/bankImportService';
import { outgoingInvoiceService, OutgoingInvoice } from '../services/outgoingInvoiceService';
import { incomingInvoiceService, IncomingInvoice } from '../services/incomingInvoiceService';
import { supplierService } from '../services/supplierService';
import {
  BankTransaction,
  BankImport,
  MatchResult,
  CSVColumnMapping,
  MatchedInvoice,
} from '../types/bankImport';
import { Grootboekrekening, Crediteur, Debiteur } from '../types/supplier';
import { grootboekCategoryLabels } from '../utils/grootboekTemplate';
import { generateGrootboekPDF } from '../lib/generateGrootboekPDF';
import { format as formatDate } from 'date-fns';
import Modal from '../components/ui/Modal';
import { usePageTitle } from '../contexts/PageTitleContext';

type TabType = 'all' | 'incoming' | 'outgoing';
type StatusFilter = 'all' | 'confirmed' | 'pending' | 'unmatched';

const BankStatementImport: React.FC = () => {
  const { user, userRole } = useAuth();
  const { selectedCompany, queryUserId } = useApp();
  const { success, error: showError } = useToast();
  usePageTitle('Bankafschrift Import');

  const [rawData, setRawData] = useState('');
  const [format, setFormat] = useState<'CSV' | 'MT940'>('CSV');
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, phase: '' });
  const [showPreview, setShowPreview] = useState(false);
  const [imports, setImports] = useState<BankImport[]>([]);
  const [expandedImport, setExpandedImport] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<BankTransaction>>({});

  const [linkingTransaction, setLinkingTransaction] = useState<MatchResult | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [showAlreadyLinked, setShowAlreadyLinked] = useState(false);

  const [outgoingInvoices, setOutgoingInvoices] = useState<OutgoingInvoice[]>([]);
  const [incomingInvoices, setIncomingInvoices] = useState<IncomingInvoice[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [importTransactions, setImportTransactions] = useState<Map<string, BankTransaction[]>>(new Map());

  const [grootboekrekeningen, setGrootboekrekeningen] = useState<Grootboekrekening[]>([]);
  const [crediteuren, setCrediteuren] = useState<Crediteur[]>([]);
  const [debiteuren, setDebiteuren] = useState<Debiteur[]>([]);
  const [importingTemplate, setImportingTemplate] = useState(false);
  const [showGrootboekModal, setShowGrootboekModal] = useState(false);
  const [selectedTransactionForGrootboek, setSelectedTransactionForGrootboek] = useState<string | null>(null);
  const [grootboekSearchTerm, setGrootboekSearchTerm] = useState('');
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const safeFormatDate = (date: Date | number | string | undefined, fmt: string): string => {
    if (!date) return 'Onbekend';
    try {
      let dateObj: Date;
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'number') {
        dateObj = new Date(date);
      } else if (typeof date === 'string') {
        dateObj = new Date(date);
      } else {
        return 'Onbekend';
      }
      if (isNaN(dateObj.getTime())) return 'Ongeldige datum';
      return formatDate(dateObj, fmt);
    } catch (error) {
      return 'Ongeldige datum';
    }
  };

  if (userRole !== 'admin' && userRole !== 'boekhouder') {
    return (
      <div className="p-6">
        <EmptyState
          icon={Shield}
          title="Geen toegang"
          description="Alleen administrators en boekhouders kunnen bankafschriften importeren"
        />
      </div>
    );
  }

  const loadInvoices = useCallback(async () => {
    if (!selectedCompany || !queryUserId) return;
    try {
      const [outgoing, incoming] = await Promise.all([
        outgoingInvoiceService.getInvoices(queryUserId, selectedCompany.id),
        incomingInvoiceService.getInvoices(queryUserId, selectedCompany.id),
      ]);
      setOutgoingInvoices(outgoing);
      setIncomingInvoices(incoming);
    } catch (e) {
      console.error('Error loading invoices:', e);
    }
  }, [selectedCompany, queryUserId]);

  const loadImportHistory = useCallback(async () => {
    if (!selectedCompany) return;
    try {
      const history = await bankImportService.getImports(selectedCompany.id);
      setImports(history);

      const transactionsMap = new Map<string, BankTransaction[]>();
      for (const imp of history) {
        const transactions = await bankImportService.getTransactionsByImport(
          selectedCompany.id,
          imp.id
        );
        transactionsMap.set(imp.id, transactions);
      }
      setImportTransactions(transactionsMap);
    } catch (e: any) {
      console.error('Error loading import history:', e);
    }
  }, [selectedCompany]);

  const loadGrootboekData = useCallback(async () => {
    if (!selectedCompany) return;
    try {
      const [gb, cred, deb] = await Promise.all([
        supplierService.getGrootboekrekeningen(selectedCompany.id),
        supplierService.getCrediteuren(selectedCompany.id),
        supplierService.getDebiteuren(selectedCompany.id),
      ]);
      setGrootboekrekeningen(gb);
      setCrediteuren(cred);
      setDebiteuren(deb);
    } catch (e) {
      console.error('Error loading grootboek data:', e);
    }
  }, [selectedCompany]);

  useEffect(() => {
    loadImportHistory();
    loadInvoices();
    loadGrootboekData();
  }, [loadImportHistory, loadInvoices, loadGrootboekData]);

  const handleParse = async () => {
    if (!rawData.trim()) {
      showError('Fout', 'Plak eerst een bankafschrift');
      return;
    }

    if (!selectedCompany || !queryUserId) {
      showError('Fout', 'Selecteer eerst een bedrijf');
      return;
    }

    try {
      setLoading(true);

      let parsedTransactions: any[] = [];

      if (format === 'CSV') {
        const parsed = bankImportService.parseCSV(rawData);
        parsedTransactions = bankImportService.parseCSVRows(
          parsed.rows,
          parsed.detectedFormat
        );
      } else {
        parsedTransactions = bankImportService.parseMT940(rawData);
      }

      const enrichedTransactions: BankTransaction[] = parsedTransactions.map((t, idx) => ({
        ...t,
        id: `temp-${idx}`,
        type: t.amount >= 0 ? 'outgoing' : 'incoming',
        status: 'unmatched' as const,
        companyId: selectedCompany.id,
        importId: 'temp',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      const results = await bankImportService.matchTransactions(
        enrichedTransactions,
        queryUserId,
        selectedCompany.id
      );

      setMatchResults(results);
      setShowPreview(true);
      success('Geslaagd', `${parsedTransactions.length} transacties geparsed`);
    } catch (e: any) {
      showError('Parse fout', e.message || 'Kon bankafschrift niet verwerken');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedCompany || !user || !queryUserId) return;

    try {
      setImporting(true);
      setImportProgress({ current: 0, total: matchResults.length, phase: 'Transacties opslaan...' });

      const confirmed = matchResults.filter(r => r.status === 'confirmed');
      const pending = matchResults.filter(r => r.status === 'pending');
      const unmatched = matchResults.filter(r => r.status === 'unmatched');

      const importData: Omit<BankImport, 'id'> = {
        companyId: selectedCompany.id,
        companyName: selectedCompany.name,
        importedBy: user.uid,
        importedByName: user.displayName || user.email || 'Unknown',
        totalLines: matchResults.length,
        format,
        confirmedCount: confirmed.length,
        pendingCount: pending.length,
        unmatchedCount: unmatched.length,
        rawData: rawData.substring(0, 10000),
        importedAt: Date.now(),
      };

      const importId = await bankImportService.saveImport(importData);

      const allTransactions: BankTransaction[] = matchResults.map((r) => ({
        ...r.transaction,
        importId,
        status: r.status,
        confidence: r.confidence,
        matchedInvoiceId: r.matchedInvoice?.invoiceId,
        matchedInvoiceType: r.matchedInvoice?.type,
        matchedInvoiceNumber: r.matchedInvoice?.invoiceNumber,
      }));

      const idMap = await bankImportService.saveTransactions(allTransactions, selectedCompany.id, importId);
      setImportProgress({ current: 0, total: confirmed.length, phase: 'Matches bevestigen...' });

      let confirmedCount = 0;
      for (const result of confirmed) {
        if (result.matchedInvoice?.invoiceId) {
          try {
            const firestoreId = idMap.get(result.transaction.id);
            if (firestoreId) {
              await bankImportService.confirmTransaction(
                firestoreId,
                selectedCompany.id,
                user.uid,
                user.displayName || user.email || 'Unknown'
              );
              confirmedCount++;
              setImportProgress(p => ({ ...p, current: confirmedCount }));
            }
          } catch (e) {
            console.error('Error confirming transaction:', e);
          }
        }
      }

      let newCrediteuren = 0;
      let newDebiteuren = 0;
      let autoCategorised = 0;
      const userName = user.displayName || user.email || 'Unknown';
      const withBeneficiary = matchResults.filter(r => r.transaction.beneficiary?.trim());
      setImportProgress({ current: 0, total: withBeneficiary.length, phase: 'Crediteuren & debiteuren verwerken...' });

      let processed = 0;
      for (const result of matchResults) {
        const t = result.transaction;
        const beneficiary = t.beneficiary?.trim();
        if (!beneficiary) continue;

        try {
          const firestoreId = idMap.get(t.id);

          if (t.amount < 0) {
            const crediteur = await supplierService.findOrCreateCrediteur(
              selectedCompany.id,
              beneficiary,
              t.accountNumber
            );
            if (crediteur.transactionCount === 0) newCrediteuren++;
            await supplierService.updateCrediteurTotals(
              crediteur.id!,
              t.amount,
              result.status === 'confirmed'
            );
            if (firestoreId && crediteur.standaardGrootboek && !t.grootboekrekening) {
              await bankImportService.updateTransaction(
                firestoreId,
                {
                  grootboekrekening: crediteur.standaardGrootboek,
                  grootboekrekeningName: crediteur.standaardGrootboekNaam,
                },
                user.uid,
                userName
              );
              autoCategorised++;
            }
          } else {
            const debiteur = await supplierService.findOrCreateDebiteur(
              selectedCompany.id,
              beneficiary,
              t.accountNumber
            );
            if (debiteur.transactionCount === 0) newDebiteuren++;
            await supplierService.updateDebiteurTotals(
              debiteur.id!,
              t.amount,
              result.status === 'confirmed'
            );
            if (firestoreId && debiteur.standaardGrootboek && !t.grootboekrekening) {
              await bankImportService.updateTransaction(
                firestoreId,
                {
                  grootboekrekening: debiteur.standaardGrootboek,
                  grootboekrekeningName: debiteur.standaardGrootboekNaam,
                },
                user.uid,
                userName
              );
              autoCategorised++;
            }
          }
        } catch (e) {
          console.error('Error processing crediteur/debiteur:', e);
        }
        processed++;
        setImportProgress(p => ({ ...p, current: processed }));
      }

      setImportProgress({ current: 0, total: 0, phase: 'Afronden...' });

      const parts = [
        `${confirmed.length} bevestigd`,
        `${pending.length} ter beoordeling`,
        `${unmatched.length} onbekend`,
        `${confirmedCount} facturen als betaald`,
      ];
      if (newCrediteuren > 0) parts.push(`${newCrediteuren} nieuwe crediteuren`);
      if (newDebiteuren > 0) parts.push(`${newDebiteuren} nieuwe debiteuren`);
      if (autoCategorised > 0) parts.push(`${autoCategorised} automatisch gecategoriseerd`);

      success('Import geslaagd', parts.join(', ') + '.');

      setRawData('');
      setMatchResults([]);
      setShowPreview(false);
      loadImportHistory();
      loadInvoices();
      loadGrootboekData();
    } catch (e: any) {
      showError('Import fout', e.message || 'Kon import niet opslaan');
      console.error(e);
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteImport = async (importId: string) => {
    if (!selectedCompany) return;
    if (!confirm('Weet je zeker dat je deze import wilt verwijderen?')) return;

    try {
      await bankImportService.deleteImport(selectedCompany.id, importId);
      success('Verwijderd', 'Import is verwijderd');
      loadImportHistory();
    } catch (e) {
      showError('Fout', 'Kon import niet verwijderen');
    }
  };

  const handleEditTransaction = (transaction: BankTransaction) => {
    setEditingTransaction(transaction.id);
    setEditedData({
      date: transaction.date,
      amount: transaction.amount,
      description: transaction.description,
      beneficiary: transaction.beneficiary,
    });
  };

  const handleSaveEdit = async (transactionId: string) => {
    if (!user || !selectedCompany) return;

    try {
      await bankImportService.updateTransaction(
        transactionId,
        editedData,
        user.uid,
        user.displayName || user.email || 'Unknown'
      );
      success('Opgeslagen', 'Transactie bijgewerkt');
      setEditingTransaction(null);
      setEditedData({});
      loadImportHistory();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon transactie niet bijwerken');
    }
  };

  const handleRefreshMatch = async (transactionId: string) => {
    if (!user || !selectedCompany || !queryUserId) return;

    try {
      setRefreshing(true);
      const results = await bankImportService.rematchTransactions(
        [transactionId],
        queryUserId,
        selectedCompany.id
      );

      if (results.length > 0 && results[0].matchedInvoice) {
        await bankImportService.updateTransaction(
          transactionId,
          {
            matchedInvoiceId: results[0].matchedInvoice.invoiceId,
            matchedInvoiceType: results[0].matchedInvoice.type,
            confidence: results[0].confidence,
            status: results[0].status,
          },
          user.uid,
          user.displayName || user.email || 'Unknown'
        );
        success('Vernieuwd', 'Match bijgewerkt');
      } else {
        success('Geen match', 'Geen nieuwe match gevonden');
      }

      loadImportHistory();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon match niet vernieuwen');
    } finally {
      setRefreshing(false);
    }
  };

  const handleConfirmTransaction = async (transactionId: string) => {
    if (!user || !selectedCompany) return;

    try {
      const allTransactions = Array.from(importTransactions.values()).flat();
      const t = allTransactions.find(tx => tx.id === transactionId);

      if (t && !t.grootboekrekening && t.beneficiary) {
        try {
          const isOutgoing = t.amount < 0;
          if (isOutgoing) {
            const crediteur = await supplierService.findOrCreateCrediteur(
              selectedCompany.id,
              t.beneficiary,
              t.accountNumber
            );
            if (crediteur.standaardGrootboek) {
              await bankImportService.updateTransaction(
                transactionId,
                { grootboekrekening: crediteur.standaardGrootboek, grootboekrekeningName: crediteur.standaardGrootboekNaam || crediteur.standaardGrootboek },
                user.uid,
                user.displayName || user.email || 'Unknown'
              );
            }
          } else {
            const debiteur = await supplierService.findOrCreateDebiteur(
              selectedCompany.id,
              t.beneficiary,
              t.accountNumber
            );
            if (debiteur.standaardGrootboek) {
              await bankImportService.updateTransaction(
                transactionId,
                { grootboekrekening: debiteur.standaardGrootboek, grootboekrekeningName: debiteur.standaardGrootboekNaam || debiteur.standaardGrootboek },
                user.uid,
                user.displayName || user.email || 'Unknown'
              );
            }
          }
        } catch {
          // Niet kritiek
        }
      }

      // Zorg dat elke bevestigde outgoing transactie óók in de suppliers-
      // lijst komt (als de bon niet apart is geüpload, zou de leverancier
      // daar anders nooit opduiken). Idempotent: alleen aangemaakt als er
      // nog geen supplier met deze naam bestaat.
      if (t && t.amount < 0 && t.beneficiary && !t.matchedInvoiceId) {
        const abs = Math.abs(t.amount);
        try {
          await supplierService.ensureSupplierFromBankTransaction(
            selectedCompany.id,
            t.beneficiary,
            {
              amount: abs,
              vatAmount: 0,
              totalAmount: abs,
              invoiceDate: t.date ? new Date(t.date) : new Date(),
            }
          );
        } catch (err) {
          console.warn('[confirm] ensureSupplier failed:', err);
        }
      }

      await bankImportService.confirmTransaction(
        transactionId,
        selectedCompany.id,
        user.uid,
        user.displayName || user.email || 'Unknown'
      );
      success('Bevestigd', 'Transactie bevestigd en factuur gemarkeerd als betaald');
      loadImportHistory();
      loadInvoices();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon transactie niet bevestigen');
    }
  };

  const handleUnconfirmTransaction = async (transactionId: string) => {
    if (!selectedCompany) return;
    if (!confirm('Weet je zeker dat je deze bevestiging wilt terugdraaien?')) return;

    try {
      await bankImportService.unconfirmTransaction(transactionId, selectedCompany.id);
      success('Teruggedraaid', 'Bevestiging teruggedraaid');
      loadImportHistory();
      loadInvoices();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon bevestiging niet terugdraaien');
    }
  };

  const handleBulkConfirmPending = async (pendingTransactions: BankTransaction[]) => {
    if (!user || !selectedCompany || pendingTransactions.length === 0) return;
    if (!confirm(`${pendingTransactions.length} transacties bevestigen?`)) return;
    try {
      setBulkConfirming(true);
      const toConfirm = pendingTransactions.filter(t => t.matchedInvoiceId);
      for (const t of toConfirm) {
        try {
          // Apply match rule for grootboek if not yet set
          if (!t.grootboekrekening) {
            const rules = await bankImportService.applyMatchRulesToTransactions([t], selectedCompany.id);
            const rule = rules.get(t.id);
            if (rule) {
              await bankImportService.updateTransaction(
                t.id,
                { grootboekrekening: rule.code, grootboekrekeningName: rule.name },
                user.uid,
                user.displayName || user.email || 'Unknown'
              );
            }
          }
          await bankImportService.confirmTransaction(t.id, selectedCompany.id, user.uid, user.displayName || user.email || 'Unknown');
        } catch { /* doorgaan met de rest */ }
      }
      success('Bevestigd', `${toConfirm.length} transacties bevestigd`);
      loadImportHistory();
      loadInvoices();
    } catch (e: any) {
      showError('Fout', e.message || 'Bulk bevestiging mislukt');
    } finally {
      setBulkConfirming(false);
    }
  };

  const handleOpenLinkModal = (result: MatchResult) => {
    setLinkingTransaction(result);
    setShowLinkModal(true);
    setInvoiceSearchTerm('');
  };

  const handleLinkInvoice = async (
    invoice: OutgoingInvoice | IncomingInvoice,
    type: 'outgoing' | 'incoming'
  ) => {
    if (!linkingTransaction || !user || !selectedCompany) return;

    try {
      const transactionId = linkingTransaction.transaction.id;
      const t = linkingTransaction.transaction;

      const updateData: Partial<BankTransaction> = {
        matchedInvoiceId: invoice.id || '',
        matchedInvoiceType: type,
        matchedInvoiceNumber: invoice.invoiceNumber,
        confidence: 100,
        status: 'pending',
      };

      if (!t.grootboekrekening && t.beneficiary) {
        try {
          if (type === 'incoming') {
            const crediteur = await supplierService.findOrCreateCrediteur(
              selectedCompany.id,
              t.beneficiary,
              t.accountNumber
            );
            if (crediteur.standaardGrootboek) {
              updateData.grootboekrekening = crediteur.standaardGrootboek;
              updateData.grootboekrekeningName = crediteur.standaardGrootboekNaam || crediteur.standaardGrootboek;
            }
          } else {
            const debiteur = await supplierService.findOrCreateDebiteur(
              selectedCompany.id,
              t.beneficiary,
              t.accountNumber
            );
            if (debiteur.standaardGrootboek) {
              updateData.grootboekrekening = debiteur.standaardGrootboek;
              updateData.grootboekrekeningName = debiteur.standaardGrootboekNaam || debiteur.standaardGrootboek;
            }
          }
        } catch {
          // Niet kritiek als crediteur/debiteur lookup mislukt
        }
      }

      await bankImportService.updateTransaction(
        transactionId,
        updateData,
        user.uid,
        user.displayName || user.email || 'Unknown'
      );

      await bankImportService.confirmTransaction(
        transactionId,
        selectedCompany.id,
        user.uid,
        user.displayName || user.email || 'Unknown'
      );

      const gbMsg = updateData.grootboekrekening
        ? ` (${updateData.grootboekrekening} automatisch toegewezen)`
        : '';
      success('Bevestigd', `Gekoppeld en bevestigd: ${invoice.invoiceNumber}${gbMsg}`);
      setShowLinkModal(false);
      setLinkingTransaction(null);
      loadImportHistory();
      loadInvoices();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon koppeling niet opslaan');
    }
  };

  const handleImportTemplate = async () => {
    if (!selectedCompany) return;
    try {
      setImportingTemplate(true);
      const count = await supplierService.importGrootboekTemplate(selectedCompany.id);
      if (count > 0) {
        success('Rekeningschema geimporteerd', `${count} grootboekrekeningen aangemaakt`);
        loadGrootboekData();
      } else {
        success('Rekeningschema', 'Alle rekeningen bestaan al');
      }
    } catch (e: any) {
      showError('Fout', e.message || 'Kon rekeningschema niet importeren');
    } finally {
      setImportingTemplate(false);
    }
  };

  const handleAssignGrootboek = async (transactionId: string, gb: Grootboekrekening) => {
    if (!user || !selectedCompany) return;
    try {
      await bankImportService.updateTransaction(
        transactionId,
        {
          grootboekrekening: gb.code,
          grootboekrekeningName: gb.name,
        },
        user.uid,
        user.displayName || user.email || 'Unknown'
      );

      const allTransactions = Array.from(importTransactions.values()).flat();
      const transaction = allTransactions.find(t => t.id === transactionId);

      // Sla matchregel op per IBAN/naam — wordt toegepast bij volgende imports
      if (transaction) {
        try {
          await bankImportService.saveOrUpdateMatchRule(
            selectedCompany.id,
            user.uid,
            transaction.accountNumber,
            transaction.beneficiary,
            gb.code,
            gb.name
          );
        } catch { /* niet kritiek */ }
      }

      // Sla ook op bij de crediteur/debiteur voor bestaande werkwijze
      if (transaction?.beneficiary) {
        try {
          if (transaction.amount < 0) {
            const crediteur = await supplierService.findOrCreateCrediteur(
              selectedCompany.id,
              transaction.beneficiary,
              transaction.accountNumber
            );
            if (crediteur.id) {
              await supplierService.updateCrediteur(crediteur.id, {
                standaardGrootboek: gb.code,
                standaardGrootboekNaam: gb.name,
              });
            }
          } else {
            const debiteur = await supplierService.findOrCreateDebiteur(
              selectedCompany.id,
              transaction.beneficiary,
              transaction.accountNumber
            );
            if (debiteur.id) {
              await supplierService.updateDebiteur(debiteur.id, {
                standaardGrootboek: gb.code,
                standaardGrootboekNaam: gb.name,
              });
            }
          }
          loadGrootboekData();
        } catch { /* niet kritiek */ }
      }

      success('Toegewezen', `${gb.code} - ${gb.name} toegewezen en onthouden`);
      setShowGrootboekModal(false);
      setSelectedTransactionForGrootboek(null);
      setGrootboekSearchTerm('');
      loadImportHistory();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon grootboekrekening niet toewijzen');
    }
  };

  const handleUnlinkTransaction = async (transactionId: string) => {
    if (!user || !selectedCompany) return;
    if (!confirm('Weet je zeker dat je deze koppeling wilt verwijderen?')) return;

    try {
      await bankImportService.updateTransaction(
        transactionId,
        {
          matchedInvoiceId: undefined,
          matchedInvoiceType: undefined,
          status: 'unmatched',
          confidence: 0,
        },
        user.uid,
        user.displayName || user.email || 'Unknown'
      );
      success('Ontkoppeld', 'Koppeling verwijderd');
      loadImportHistory();
    } catch (e: any) {
      showError('Fout', e.message || 'Kon koppeling niet verwijderen');
    }
  };

  const getDuplicateBadge = () => (
    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
      <AlertCircle className="w-3 h-3 mr-1" />
      Mogelijk duplicaat
    </span>
  );

  const getStatusBadge = (status: 'confirmed' | 'pending' | 'unmatched', confidence?: number) => {
    if (status === 'confirmed') {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Bevestigd ({confidence}%)
        </span>
      );
    } else if (status === 'pending') {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <Clock className="w-3 h-3 mr-1" />
          Ter beoordeling ({confidence}%)
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Geen match
        </span>
      );
    }
  };

  const filteredPreviewResults = matchResults.filter((r) => {
    if (activeTab === 'incoming' && r.transaction.type !== 'incoming') return false;
    if (activeTab === 'outgoing' && r.transaction.type !== 'outgoing') return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const confirmedResults = matchResults.filter(r => r.status === 'confirmed');
  const pendingResults = matchResults.filter(r => r.status === 'pending');
  const unmatchedResults = matchResults.filter(r => r.status === 'unmatched');
  const duplicateResults = matchResults.filter(r => r.transaction.isDuplicate);

  const openGrootboekModal = (txId: string) => {
    setSelectedTransactionForGrootboek(txId);
    setShowGrootboekModal(true);
    setGrootboekSearchTerm('');
  };

  const renderTxRow = (t: BankTransaction, isEditing: boolean) => {
    const borderColor =
      t.isDuplicate ? 'border-l-orange-400' :
      t.status === 'confirmed' ? 'border-l-green-500' :
      t.status === 'pending' ? 'border-l-amber-400' :
      'border-l-gray-300 dark:border-l-gray-600';

    const confidence = t.confidence || 0;
    const confColor = confidence >= 80 ? 'bg-green-500' : confidence >= 40 ? 'bg-amber-400' : 'bg-red-400';

    if (isEditing) {
      return (
        <div className="space-y-2 p-3">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={editedData.date ? safeFormatDate(editedData.date, 'yyyy-MM-dd') : ''}
              onChange={(e) => setEditedData({ ...editedData, date: new Date(e.target.value).getTime() })}
              className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-xs" />
            <input type="number" step="0.01" value={editedData.amount || 0}
              onChange={(e) => setEditedData({ ...editedData, amount: parseFloat(e.target.value) })}
              className="px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-xs" />
          </div>
          <input type="text" value={editedData.description || ''}
            onChange={(e) => setEditedData({ ...editedData, description: e.target.value })}
            className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 text-xs" />
          <div className="flex gap-1">
            <button onClick={() => handleSaveEdit(t.id)} className="px-2 py-1 bg-green-600 text-white rounded text-xs">Opslaan</button>
            <button onClick={() => { setEditingTransaction(null); setEditedData({}); }} className="px-2 py-1 bg-gray-500 text-white rounded text-xs">Annuleren</button>
          </div>
        </div>
      );
    }

    return (
      <div className={`flex items-start gap-3 text-xs p-2.5 border-l-4 ${borderColor}`}>
        {/* Datum + richting */}
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5 w-[68px]">
          {t.type === 'outgoing'
            ? <TrendingUp className="w-3 h-3 text-green-600" />
            : <TrendingDown className="w-3 h-3 text-red-600" />}
          <span className="text-[10px] text-gray-400 text-center leading-tight">{safeFormatDate(t.date, 'dd-MM-yy')}</span>
        </div>

        {/* Partij + omschrijving + grootboek */}
        <div className="flex-1 min-w-0">
          {t.beneficiary && (
            <div className="font-medium text-gray-900 dark:text-white truncate">{t.beneficiary}</div>
          )}
          <div className="text-gray-500 dark:text-gray-300 truncate">{t.description}</div>
          {t.matchedInvoiceId && (
            <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
              ↔ {t.matchedInvoiceNumber || t.matchedInvoiceId}
            </div>
          )}
          {/* Grootboek chip — altijd zichtbaar, klikbaar */}
          <button
            onClick={() => openGrootboekModal(t.id)}
            className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors ${
              t.grootboekrekening
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200'
                : 'border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:border-blue-400 hover:text-blue-500'
            }`}
          >
            <Tag className="w-2.5 h-2.5" />
            {t.grootboekrekening ? `${t.grootboekrekening} · ${t.grootboekrekeningName}` : 'Kies rekening'}
          </button>
          {/* Confidence bar */}
          {t.status !== 'confirmed' && confidence > 0 && (
            <div className="mt-1 flex items-center gap-1">
              <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
                <div className={`h-1 rounded-full ${confColor}`} style={{ width: `${confidence}%` }} />
              </div>
              <span className="text-[10px] text-gray-400">{confidence}%</span>
            </div>
          )}
        </div>

        {/* Bedrag + acties */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className={`font-bold ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            € {Math.abs(t.amount).toFixed(2)}
          </span>
          {t.isDuplicate && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">dup.</span>
          )}
          <div className="flex items-center gap-0.5 mt-0.5">
            {t.status === 'confirmed' && (
              <button onClick={() => handleUnconfirmTransaction(t.id)}
                className="p-1 text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded"
                title="Terugdraaien">
                <X className="w-3 h-3" />
              </button>
            )}
            {t.status !== 'confirmed' && (
              <>
                {t.matchedInvoiceId && (
                  <button onClick={() => handleConfirmTransaction(t.id)}
                    className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                    title="Bevestigen">
                    <CheckCircle className="w-3 h-3" />
                  </button>
                )}
                <button onClick={() => handleRefreshMatch(t.id)} disabled={refreshing}
                  className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                  title="Ververs match">
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={() => handleEditTransaction(t)}
                  className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="Bewerken">
                  <Edit2 className="w-3 h-3" />
                </button>
                <button onClick={() => {
                  const result: MatchResult = { transaction: t, status: t.status, confidence: t.confidence || 0 };
                  handleOpenLinkModal(result);
                }} className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                  title="Handmatig koppelen">
                  <Link className="w-3 h-3" />
                </button>
                {t.matchedInvoiceId && (
                  <button onClick={() => handleUnlinkTransaction(t.id)}
                    className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    title="Ontkoppelen">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Upload}
          title="Geen bedrijf geselecteerd"
          description="Selecteer eerst een bedrijf om bankafschriften te importeren"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Bankafschrift Import
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Import en match bankafschriften met facturen
          </p>
        </div>
        {userRole !== 'boekhouder' && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
              <Shield className="w-4 h-4 mr-1" />
              Admin Only
            </span>
          </div>
        )}
      </div>

      {/* Upload / preview zijn alleen relevant voor admin-rollen. De
          boekhouder werkt op deze pagina alleen met bevestiging/matching
          van reeds geïmporteerde transacties + de import-geschiedenis. */}
      {userRole !== 'boekhouder' && (
      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Nieuw bankafschrift importeren
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFormat('CSV')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  format === 'CSV'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                CSV
              </button>
              <button
                onClick={() => setFormat('MT940')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  format === 'MT940'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                MT940
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Plak bankafschrift hier
            </label>
            <textarea
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
              placeholder={
                format === 'CSV'
                  ? 'Datum;Bedrag;Omschrijving;Begunstigde\n2024-01-15;1250.00;Factuur 2024-001;Klant BV'
                  : ':20:STMT001\n:25:NL12BANK0123456789\n:28C:001/001\n:60F:C240115EUR1000,00'
              }
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleParse} disabled={loading || !rawData.trim()} className="flex-1">
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Verwerken...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Verwerk en Match
                </>
              )}
            </Button>
            <Button
              onClick={() => {
                setRawData('');
                setMatchResults([]);
                setShowPreview(false);
              }}
              variant="outline"
            >
              <X className="w-4 h-4 mr-2" />
              Wissen
            </Button>
          </div>
        </div>
      </Card>
      )}

      {userRole !== 'boekhouder' && showPreview && matchResults.length > 0 && (
        <Card>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Importvoorbeeld ({matchResults.length} transacties)
              </h2>
              <div className="flex gap-3 text-sm">
                <span className="flex items-center text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {confirmedResults.length} bevestigd
                </span>
                <span className="flex items-center text-yellow-600 dark:text-yellow-400">
                  <Clock className="w-4 h-4 mr-1" />
                  {pendingResults.length} ter beoordeling
                </span>
                <span className="flex items-center text-gray-600 dark:text-gray-300">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {unmatchedResults.length} geen match
                </span>
              </div>
            </div>

            {duplicateResults.length > 0 && (
              <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="font-medium text-orange-800 dark:text-orange-300">
                    {duplicateResults.length} mogelijke duplicaten gevonden
                  </span>
                  <span className="text-orange-700 dark:text-orange-400 ml-1">
                    — deze transacties lijken al eerder te zijn geïmporteerd (zelfde datum, bedrag en omschrijving). Ze worden gemarkeerd maar toch geïmporteerd.
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                Alle
              </button>
              <button
                onClick={() => setActiveTab('outgoing')}
                className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'outgoing'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Uitgaand ({matchResults.filter(r => r.transaction.type === 'outgoing').length})
              </button>
              <button
                onClick={() => setActiveTab('incoming')}
                className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'incoming'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                Inkomend ({matchResults.filter(r => r.transaction.type === 'incoming').length})
              </button>
            </div>

            <div className="space-y-6">
              {confirmedResults.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-green-600 dark:text-green-400 mb-3 flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Bevestigd ({confirmedResults.length})
                  </h3>
                  <div className="space-y-2">
                    {confirmedResults
                      .filter((r) => {
                        if (activeTab === 'incoming' && r.transaction.type !== 'incoming') return false;
                        if (activeTab === 'outgoing' && r.transaction.type !== 'outgoing') return false;
                        return true;
                      })
                      .map((result, index) => (
                        <div
                          key={index}
                          className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {result.transaction.type === 'outgoing' ? (
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-600" />
                                )}
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {safeFormatDate(result.transaction.date, 'dd-MM-yyyy')}
                                </span>
                                <span
                                  className={`text-sm font-bold ${
                                    result.transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}
                                >
                                  € {Math.abs(result.transaction.amount).toFixed(2)}
                                </span>
                                {getStatusBadge(result.status, result.confidence)}
                                {result.transaction.isDuplicate && getDuplicateBadge()}
                              </div>
                              <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                {result.transaction.description}
                              </div>
                              {result.transaction.beneficiary && (
                                <div className="text-xs text-gray-600 dark:text-gray-300">
                                  Begunstigde: {result.transaction.beneficiary}
                                </div>
                              )}
                              {result.matchedInvoice && (
                                <div className="mt-2 text-xs">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    Gematcht met: {result.matchedInvoice.invoiceNumber}
                                  </span>
                                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                                    {result.matchedInvoice.clientName}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {pendingResults.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-yellow-600 dark:text-yellow-400 mb-3 flex items-center">
                    <Clock className="w-5 h-5 mr-2" />
                    Ter beoordeling ({pendingResults.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingResults
                      .filter((r) => {
                        if (activeTab === 'incoming' && r.transaction.type !== 'incoming') return false;
                        if (activeTab === 'outgoing' && r.transaction.type !== 'outgoing') return false;
                        return true;
                      })
                      .map((result, index) => (
                        <div
                          key={index}
                          className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {result.transaction.type === 'outgoing' ? (
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-600" />
                                )}
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {safeFormatDate(result.transaction.date, 'dd-MM-yyyy')}
                                </span>
                                <span
                                  className={`text-sm font-bold ${
                                    result.transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}
                                >
                                  € {Math.abs(result.transaction.amount).toFixed(2)}
                                </span>
                                {getStatusBadge(result.status, result.confidence)}
                                {result.transaction.isDuplicate && getDuplicateBadge()}
                              </div>
                              <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                {result.transaction.description}
                              </div>
                              {result.transaction.beneficiary && (
                                <div className="text-xs text-gray-600 dark:text-gray-300">
                                  Begunstigde: {result.transaction.beneficiary}
                                </div>
                              )}
                              {result.matchedInvoice && (
                                <div className="mt-2 text-xs">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    Mogelijk: {result.matchedInvoice.invoiceNumber}
                                  </span>
                                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                                    {result.matchedInvoice.clientName}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {unmatchedResults.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-600 dark:text-gray-300 mb-3 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Geen match ({unmatchedResults.length})
                  </h3>
                  <div className="space-y-2">
                    {unmatchedResults
                      .filter((r) => {
                        if (activeTab === 'incoming' && r.transaction.type !== 'incoming') return false;
                        if (activeTab === 'outgoing' && r.transaction.type !== 'outgoing') return false;
                        return true;
                      })
                      .map((result, index) => (
                        <div
                          key={index}
                          className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {result.transaction.type === 'outgoing' ? (
                                  <TrendingUp className="w-4 h-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-600" />
                                )}
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {safeFormatDate(result.transaction.date, 'dd-MM-yyyy')}
                                </span>
                                <span
                                  className={`text-sm font-bold ${
                                    result.transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}
                                >
                                  € {Math.abs(result.transaction.amount).toFixed(2)}
                                </span>
                                {getStatusBadge(result.status, result.confidence)}
                                {result.transaction.isDuplicate && getDuplicateBadge()}
                              </div>
                              <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                {result.transaction.description}
                              </div>
                              {result.transaction.beneficiary && (
                                <div className="text-xs text-gray-600 dark:text-gray-300">
                                  Begunstigde: {result.transaction.beneficiary}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button onClick={handleImport} disabled={importing}>
                <Upload className="w-4 h-4 mr-2" />
                Importeer {matchResults.length} transacties
              </Button>
            </div>
          </div>
        </Card>
      )}

      {importing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4">
            <div className="text-center space-y-5">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                <Upload className="w-6 h-6 text-amber-600 dark:text-amber-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Import bezig...
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
                  {importProgress.phase}
                </p>
              </div>
              {importProgress.total > 0 && (
                <div className="space-y-1.5">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${Math.round((importProgress.current / importProgress.total) * 100)}%`,
                        backgroundColor: '#cd853f',
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-300">
                    <span>{importProgress.current} / {importProgress.total}</span>
                    <span>{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      <Card>
        <div className="p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Import Geschiedenis
          </h2>

          {imports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nog geen imports"
              description="Je hebt nog geen bankafschriften geïmporteerd"
            />
          ) : (
            <div className="space-y-2">
              {imports.map((imp) => {
                const transactions = importTransactions.get(imp.id) || [];
                const confirmed = transactions.filter(t => t.status === 'confirmed');
                const pending = transactions.filter(t => t.status === 'pending');
                const unmatched = transactions.filter(t => t.status === 'unmatched');

                return (
                  <div
                    key={imp.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    <div
                      className="p-3 sm:p-4 flex items-start justify-between gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => setExpandedImport(expandedImport === imp.id ? null : imp.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {safeFormatDate(imp.importedAt, 'dd-MM-yyyy HH:mm')}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-300">
                            {imp.format}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-300">
                            {imp.totalLines} regels
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                          <span className="text-xs text-green-600">
                            {confirmed.length} bevestigd
                          </span>
                          <span className="text-xs text-yellow-600">
                            {pending.length} ter beoordeling
                          </span>
                          <span className="text-xs text-gray-600">
                            {unmatched.length} geen match
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 truncate">
                          Door: {imp.importedByName}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImport(imp.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {expandedImport === imp.id ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {expandedImport === imp.id && transactions.length > 0 && (
                      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        {/* Stats bar */}
                        <div className="flex items-center gap-3 px-4 py-2 text-xs border-b border-gray-200 dark:border-gray-700">
                          <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" />{confirmed.length} bevestigd</span>
                          <span className="flex items-center gap-1 text-amber-500"><Clock className="w-3 h-3" />{pending.length} ter beoordeling</span>
                          <span className="flex items-center gap-1 text-gray-500"><AlertCircle className="w-3 h-3" />{unmatched.length} geen match</span>
                          {pending.filter(t => t.matchedInvoiceId).length > 0 && (
                            <button
                              onClick={() => handleBulkConfirmPending(pending)}
                              disabled={bulkConfirming}
                              className="ml-auto flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                            >
                              {bulkConfirming ? <LoadingSpinner size="sm" /> : <CheckSquare className="w-3 h-3" />}
                              Bevestig alle ter beoordeling
                            </button>
                          )}
                        </div>

                        {confirmed.length > 0 && (() => {
                          const key = `${imp.id}-confirmed`;
                          const isOpen = expandedSections.has(key);
                          return (
                            <div>
                              <button
                                onClick={() => toggleSection(key)}
                                className="w-full flex items-center justify-between px-4 py-1.5 text-xs font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20 border-b border-gray-100 dark:border-gray-700/50 transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Bevestigd ({confirmed.length})
                                </span>
                                {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                              {isOpen && (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700/50 bg-white dark:bg-gray-900">
                                  {confirmed.map((t) => (
                                    <div key={t.id}>{renderTxRow(t, false)}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {pending.length > 0 && (() => {
                          const key = `${imp.id}-pending`;
                          const isOpen = expandedSections.has(key);
                          return (
                            <div>
                              <button
                                onClick={() => toggleSection(key)}
                                className="w-full flex items-center justify-between px-4 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20 border-b border-gray-100 dark:border-gray-700/50 transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <Clock className="w-3.5 h-3.5" />
                                  Ter beoordeling ({pending.length})
                                </span>
                                {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                              {isOpen && (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700/50 bg-white dark:bg-gray-900">
                                  {pending.map((t) => {
                                    const isEditing = editingTransaction === t.id;
                                    return (
                                      <div key={t.id}>
                                        {renderTxRow(t, isEditing)}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {unmatched.length > 0 && (() => {
                          const key = `${imp.id}-unmatched`;
                          const isOpen = expandedSections.has(key);
                          return (
                            <div>
                              <button
                                onClick={() => toggleSection(key)}
                                className="w-full flex items-center justify-between px-4 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700/50 transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  Geen match ({unmatched.length})
                                </span>
                                {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                              {isOpen && (
                                <div className="divide-y divide-gray-100 dark:divide-gray-700/50 bg-white dark:bg-gray-900">
                                  {unmatched.map((t) => (
                                    <div key={t.id}>{renderTxRow(t, editingTransaction === t.id)}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {showLinkModal && linkingTransaction && (
        <Modal
          isOpen={showLinkModal}
          onClose={() => {
            setShowLinkModal(false);
            setLinkingTransaction(null);
            setInvoiceSearchTerm('');
            setShowAlreadyLinked(false);
          }}
          title="Koppel aan factuur"
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Transactie</h3>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">Datum:</span>{' '}
                    {safeFormatDate(linkingTransaction.transaction.date, 'dd-MM-yyyy')}
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">Bedrag:</span>{' '}
                    <span
                      className={
                        linkingTransaction.transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      € {Math.abs(linkingTransaction.transaction.amount).toFixed(2)}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600 dark:text-gray-300">Omschrijving:</span>{' '}
                    {linkingTransaction.transaction.description}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Zoek factuur
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showAlreadyLinked}
                    onChange={(e) => setShowAlreadyLinked(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-amber-500"
                  />
                  Toon al gekoppeld
                </label>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={invoiceSearchTerm}
                  onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                  placeholder="Zoek op factuurnummer of klant/leverancier"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-4">
              {/* Inkomende facturen (inkoop) — primair voor uitgaande betalingen */}
              {(() => {
                const linkedIds = new Set(
                  Array.from(importTransactions.values()).flat()
                    .filter(t => t.matchedInvoiceId)
                    .map(t => t.matchedInvoiceId!)
                );
                const filtered = incomingInvoices.filter(
                  (inv) =>
                    (showAlreadyLinked || !linkedIds.has(inv.id || '')) &&
                    (!invoiceSearchTerm ||
                      inv.invoiceNumber.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
                      inv.supplierName.toLowerCase().includes(invoiceSearchTerm.toLowerCase()))
                );
                if (filtered.length === 0) return null;
                return (
                  <div>
                    <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
                      Inkomende facturen (inkoop)
                    </h4>
                    <div className="space-y-2">
                      {filtered.map((invoice) => {
                        const paid = invoice.paidAmount || 0;
                        const pct = invoice.totalAmount > 0 ? Math.min(100, (paid / invoice.totalAmount) * 100) : 0;
                        const isPartial = paid > 0 && paid < invoice.totalAmount;
                        return (
                          <button
                            key={invoice.id}
                            onClick={() => handleLinkInvoice(invoice, 'incoming')}
                            className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {invoice.invoiceNumber}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                  {invoice.supplierName}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {safeFormatDate(invoice.invoiceDate, 'dd-MM-yyyy')}
                                </div>
                                {isPartial && (
                                  <div className="mt-1.5">
                                    <div className="flex justify-between text-xs text-amber-600 mb-0.5">
                                      <span>Deelbetaling</span>
                                      <span>€ {paid.toFixed(2)} / € {invoice.totalAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1">
                                      <div className="bg-amber-500 h-1 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="text-right ml-3 flex-shrink-0">
                                <div className="font-medium text-gray-900 dark:text-white">
                                  € {invoice.totalAmount.toFixed(2)}
                                </div>
                                <div className={`text-xs mt-1 ${
                                  invoice.status === 'paid' ? 'text-green-600' :
                                  invoice.status === 'partial' ? 'text-amber-600' :
                                  'text-gray-500'
                                }`}>{invoice.status}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Uitgaande facturen (verkoop) — primair voor inkomende betalingen */}
              {(() => {
                const linkedIds = new Set(
                  Array.from(importTransactions.values()).flat()
                    .filter(t => t.matchedInvoiceId)
                    .map(t => t.matchedInvoiceId!)
                );
                const filtered = outgoingInvoices.filter(
                  (inv) =>
                    (showAlreadyLinked || !linkedIds.has(inv.id || '')) &&
                    (!invoiceSearchTerm ||
                      inv.invoiceNumber.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
                      inv.clientName.toLowerCase().includes(invoiceSearchTerm.toLowerCase()))
                );
                if (filtered.length === 0) return null;
                return (
                  <div>
                    <h4 className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">
                      Uitgaande facturen (verkoop)
                    </h4>
                    <div className="space-y-2">
                      {filtered.map((invoice) => {
                        const paid = invoice.paidAmount || 0;
                        const pct = invoice.totalAmount > 0 ? Math.min(100, (paid / invoice.totalAmount) * 100) : 0;
                        const isPartial = paid > 0 && paid < invoice.totalAmount;
                        return (
                          <button
                            key={invoice.id}
                            onClick={() => handleLinkInvoice(invoice, 'outgoing')}
                            className="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {invoice.invoiceNumber}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                  {invoice.clientName}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {safeFormatDate(invoice.invoiceDate, 'dd-MM-yyyy')}
                                </div>
                                {isPartial && (
                                  <div className="mt-1.5">
                                    <div className="flex justify-between text-xs text-amber-600 mb-0.5">
                                      <span>Deelbetaling</span>
                                      <span>€ {paid.toFixed(2)} / € {invoice.totalAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1">
                                      <div className="bg-amber-500 h-1 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="text-right ml-3 flex-shrink-0">
                                <div className="font-medium text-gray-900 dark:text-white">
                                  € {invoice.totalAmount.toFixed(2)}
                                </div>
                                <div className={`text-xs mt-1 ${
                                  invoice.status === 'paid' ? 'text-green-600' :
                                  invoice.status === 'partial' ? 'text-amber-600' :
                                  'text-gray-500'
                                }`}>{invoice.status}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {incomingInvoices.length === 0 && outgoingInvoices.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-300 py-4">
                  Geen facturen gevonden
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}
      {showGrootboekModal && selectedTransactionForGrootboek && (
        <Modal
          isOpen={showGrootboekModal}
          onClose={() => {
            setShowGrootboekModal(false);
            setSelectedTransactionForGrootboek(null);
            setGrootboekSearchTerm('');
          }}
          title="Grootboekrekening toewijzen"
          size="lg"
        >
          <div className="space-y-4">
            {grootboekrekeningen.length === 0 ? (
              <div className="text-center py-6">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-300 mb-3">
                  Nog geen rekeningschema ingeladen
                </p>
                <Button onClick={handleImportTemplate} disabled={importingTemplate}>
                  {importingTemplate ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Importeer standaard rekeningschema
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={grootboekSearchTerm}
                    onChange={(e) => setGrootboekSearchTerm(e.target.value)}
                    placeholder="Zoek op code of naam..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="max-h-96 overflow-y-auto space-y-1">
                  {Object.entries(
                    grootboekrekeningen
                      .filter(
                        (gb) =>
                          !grootboekSearchTerm ||
                          gb.code.includes(grootboekSearchTerm) ||
                          gb.name.toLowerCase().includes(grootboekSearchTerm.toLowerCase()) ||
                          (grootboekCategoryLabels[gb.category as keyof typeof grootboekCategoryLabels] || '')
                            .toLowerCase()
                            .includes(grootboekSearchTerm.toLowerCase())
                      )
                      .reduce((acc, gb) => {
                        const label = grootboekCategoryLabels[gb.category as keyof typeof grootboekCategoryLabels] || gb.category;
                        if (!acc[label]) acc[label] = [];
                        acc[label].push(gb);
                        return acc;
                      }, {} as Record<string, Grootboekrekening[]>)
                  ).map(([category, accounts]) => (
                    <div key={category}>
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-300 px-2 py-1 bg-gray-50 dark:bg-gray-800 sticky top-0">
                        {category}
                      </div>
                      {accounts.map((gb) => (
                        <button
                          key={gb.id}
                          onClick={() => handleAssignGrootboek(selectedTransactionForGrootboek, gb)}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 w-12">
                              {gb.code}
                            </span>
                            <span className="text-gray-900 dark:text-white">{gb.name}</span>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            gb.type === 'debet'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                          }`}>
                            {gb.type}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BankStatementImport;
