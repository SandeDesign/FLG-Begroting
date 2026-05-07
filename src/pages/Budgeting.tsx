import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Wallet,
  Plus,
  Pencil,
  Trash2,
  Phone,
  Monitor,
  Car,
  Shield,
  Zap,
  CreditCard,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Calendar,
  Building2,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Users,
  Briefcase,
  Package,
  Lightbulb,
  Handshake,
  Award,
  Target,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Megaphone,
  Home,
  BarChart3,
  FileText,
  Eye,
  EyeOff,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { BudgetItem, BudgetCategory, BudgetFrequency, BudgetType, BudgetCostCategory, BudgetIncomeCategory, ProjectionConfidence } from '../types';
import {
  getBudgetItems,
  createBudgetItem,
  updateBudgetItem,
  deleteBudgetItem,
  calculateMonthlyBudget,
  calculateYearlyBudget,
  getPayrollCalculations,
} from '../services/firebase';
import { outgoingInvoiceService, OutgoingInvoice } from '../services/outgoingInvoiceService';
import { incomingInvoiceService } from '../services/incomingInvoiceService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import { usePageTitle } from '../contexts/PageTitleContext';

// Cost category configuration
const COST_CATEGORY_CONFIG: Record<BudgetCostCategory, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  telecom: { icon: Phone, label: 'Telecom', bgColor: 'bg-blue-50', textColor: 'text-blue-600', borderColor: 'border-blue-200' },
  software: { icon: Monitor, label: 'Software', bgColor: 'bg-purple-50', textColor: 'text-purple-600', borderColor: 'border-purple-200' },
  vehicle: { icon: Car, label: 'Voertuigen', bgColor: 'bg-emerald-50', textColor: 'text-emerald-600', borderColor: 'border-emerald-200' },
  insurance: { icon: Shield, label: 'Verzekeringen', bgColor: 'bg-orange-50', textColor: 'text-orange-600', borderColor: 'border-orange-200' },
  utilities: { icon: Zap, label: 'Nutsvoorzieningen', bgColor: 'bg-yellow-50', textColor: 'text-yellow-600', borderColor: 'border-yellow-200' },
  subscriptions: { icon: CreditCard, label: 'Abonnementen', bgColor: 'bg-pink-50', textColor: 'text-pink-600', borderColor: 'border-pink-200' },
  personnel: { icon: Users, label: 'Personeel', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600', borderColor: 'border-indigo-200' },
  marketing: { icon: Megaphone, label: 'Marketing', bgColor: 'bg-rose-50', textColor: 'text-rose-600', borderColor: 'border-rose-200' },
  office: { icon: Home, label: 'Kantoor', bgColor: 'bg-teal-50', textColor: 'text-teal-600', borderColor: 'border-teal-200' },
  other: { icon: MoreHorizontal, label: 'Overig', bgColor: 'bg-gray-50 dark:bg-gray-900', textColor: 'text-gray-600 dark:text-gray-300 dark:text-gray-500', borderColor: 'border-gray-200 dark:border-gray-700' },
};

// Income category configuration
const INCOME_CATEGORY_CONFIG: Record<BudgetIncomeCategory, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  services: { icon: Briefcase, label: 'Diensten', bgColor: 'bg-emerald-50', textColor: 'text-emerald-600', borderColor: 'border-emerald-200' },
  products: { icon: Package, label: 'Producten', bgColor: 'bg-blue-50', textColor: 'text-blue-600', borderColor: 'border-blue-200' },
  subscriptions: { icon: CreditCard, label: 'SaaS/Abonnementen', bgColor: 'bg-purple-50', textColor: 'text-purple-600', borderColor: 'border-purple-200' },
  consulting: { icon: Lightbulb, label: 'Consultancy', bgColor: 'bg-amber-50', textColor: 'text-amber-600', borderColor: 'border-amber-200' },
  licensing: { icon: Award, label: 'Licenties', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600', borderColor: 'border-indigo-200' },
  partnerships: { icon: Handshake, label: 'Partnerships', bgColor: 'bg-pink-50', textColor: 'text-pink-600', borderColor: 'border-pink-200' },
  grants: { icon: Target, label: 'Subsidies', bgColor: 'bg-teal-50', textColor: 'text-teal-600', borderColor: 'border-teal-200' },
  other: { icon: MoreHorizontal, label: 'Overig', bgColor: 'bg-gray-50 dark:bg-gray-900', textColor: 'text-gray-600 dark:text-gray-300 dark:text-gray-500', borderColor: 'border-gray-200 dark:border-gray-700' },
};

const CONFIDENCE_CONFIG: Record<ProjectionConfidence, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
  weight: number;
}> = {
  confirmed: { icon: CheckCircle2, label: 'Bevestigd', color: 'text-emerald-600', bgColor: 'bg-emerald-100', weight: 1.0 },
  likely: { icon: TrendingUp, label: 'Waarschijnlijk', color: 'text-blue-600', bgColor: 'bg-blue-100', weight: 0.75 },
  potential: { icon: AlertCircle, label: 'Potentieel', color: 'text-amber-600', bgColor: 'bg-amber-100', weight: 0.5 },
  speculative: { icon: HelpCircle, label: 'Speculatief', color: 'text-gray-500 dark:text-gray-300 dark:text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-800', weight: 0.25 },
};

const FREQUENCY_LABELS: Record<BudgetFrequency, string> = {
  monthly: 'per maand',
  quarterly: 'per kwartaal',
  yearly: 'per jaar',
};

type ViewTab = 'overview' | 'costs' | 'income' | 'projections';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
}

interface UseOfFundsItem {
  id: string;
  category: string;
  amount: number;
  description: string;
}

interface RiskItem {
  id: string;
  risk: string;
  mitigation: string;
}

interface InvestmentPitch {
  companyId: string;
  problemStatement: string;
  solutionStatement: string;
  elevatorPitch: string;
  differentiator: string;
  whyNow: string;
  targetMarket: string;
  tam: number;
  sam: number;
  som: number;
  team: TeamMember[];
  useOfFunds: UseOfFundsItem[];
  askingAmount: number;
  askingCurrency: string;
  runway: number;
  risks: RiskItem[];
  createdAt?: Date;
  updatedAt?: Date;
}

interface BudgetFormData {
  type: BudgetType;
  name: string;
  category: BudgetCategory;
  amount: string;
  frequency: BudgetFrequency;
  startDate: string;
  endDate: string;
  supplier: string;
  contractNumber: string;
  notes: string;
  isActive: boolean;
  confidence: ProjectionConfidence;
  growthRate: string;
}

const initialFormData: BudgetFormData = {
  type: 'cost',
  name: '',
  category: 'software',
  amount: '',
  frequency: 'monthly',
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
  supplier: '',
  contractNumber: '',
  notes: '',
  isActive: true,
  confidence: 'confirmed',
  growthRate: '0',
};

const Budgeting: React.FC = () => {
  const { user, adminUserId } = useAuth();
  const { selectedCompany, queryUserId } = useApp();
  const dataUserId = queryUserId || selectedCompany?.userId || adminUserId;
  const { success, error: showError } = useToast();
  usePageTitle('Begroting & Projecties');
  const exportRef = useRef<HTMLDivElement>(null);

  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [outgoingInvoices, setOutgoingInvoices] = useState<OutgoingInvoice[]>([]);
  const [incomingInvoices, setIncomingInvoices] = useState<any[]>([]);
  const [payrollCalculations, setPayrollCalculations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [formData, setFormData] = useState<BudgetFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('overview');
  const [showActualData, setShowActualData] = useState(true);
  const [projectionYears, setProjectionYears] = useState(3);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isPitchDeckOpen, setIsPitchDeckOpen] = useState(false);

  // Investment Pitch State

  const loadData = useCallback(async () => {
    if (!user || !dataUserId || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load budget items
      const items = await getBudgetItems(dataUserId, selectedCompany.id);
      setBudgetItems(items);

      // Load actual invoice data for comparison
      const [outgoing, incoming] = await Promise.all([
        outgoingInvoiceService.getInvoices(dataUserId, selectedCompany.id),
        incomingInvoiceService.getInvoices(dataUserId, selectedCompany.id),
      ]);

      setOutgoingInvoices(outgoing);
      setIncomingInvoices(incoming);

      // Load payroll data for employer companies only
      if (selectedCompany.companyType === 'employer') {
        const payroll = await getPayrollCalculations(dataUserId);
        setPayrollCalculations(payroll);
      } else {
        setPayrollCalculations([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Fout bij laden', 'Kon gegevens niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, dataUserId, selectedCompany, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh functie
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setTimeout(() => setRefreshing(false), 500);
    success('Ververst', 'Gegevens zijn bijgewerkt');
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Map budget categories to invoice categories for matching
  const matchInvoiceToCategory = (invoice: OutgoingInvoice | any, type: 'income' | 'cost'): BudgetCategory | null => {
    const description = invoice.description?.toLowerCase() || invoice.notes?.toLowerCase() || '';

    if (type === 'income') {
      if (description.includes('consultancy') || description.includes('advies')) return 'consulting';
      if (description.includes('product')) return 'products';
      if (description.includes('subscription') || description.includes('abonnement')) return 'subscriptions';
      if (description.includes('licentie') || description.includes('license')) return 'licensing';
      return 'services';
    } else {
      if (description.includes('telefoon') || description.includes('mobiel')) return 'telecom';
      if (description.includes('software') || description.includes('saas')) return 'software';
      if (description.includes('auto') || description.includes('lease') || description.includes('benzine')) return 'vehicle';
      if (description.includes('verzekering') || description.includes('insurance')) return 'insurance';
      if (description.includes('elektra') || description.includes('gas') || description.includes('water')) return 'utilities';
      if (description.includes('personeel') || description.includes('salaris')) return 'personnel';
      if (description.includes('marketing') || description.includes('advertentie')) return 'marketing';
      if (description.includes('kantoor') || description.includes('huur')) return 'office';
      return 'other';
    }
  };

  // Get invoices for a specific category
  const getInvoicesForCategory = (category: string, type: 'income' | 'cost') => {
    const currentYear = new Date().getFullYear();
    if (type === 'income') {
      return outgoingInvoices.filter(inv => {
        const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
        return invDate.getFullYear() === currentYear &&
               inv.status !== 'cancelled' &&
               matchInvoiceToCategory(inv, 'income') === category;
      });
    } else {
      return incomingInvoices.filter(inv => {
        const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
        return invDate.getFullYear() === currentYear &&
               matchInvoiceToCategory(inv, 'cost') === category;
      });
    }
  };

  // Calculate monthly amount from any frequency
  const getMonthlyAmount = (item: BudgetItem) => {
    switch (item.frequency) {
      case 'monthly': return item.amount;
      case 'quarterly': return item.amount / 3;
      case 'yearly': return item.amount / 12;
      default: return item.amount;
    }
  };

  // Filter items by type
  const costItems = budgetItems.filter(i => i.type === 'cost' || !i.type);
  const incomeItems = budgetItems.filter(i => i.type === 'income');
  const activeCostItems = costItems.filter(i => i.isActive);
  const activeIncomeItems = incomeItems.filter(i => i.isActive);

  // Calculate totals
  const monthlyCosts = activeCostItems.reduce((sum, item) => sum + getMonthlyAmount(item), 0);
  const monthlyIncome = activeIncomeItems.reduce((sum, item) => sum + getMonthlyAmount(item), 0);
  const monthlyProfit = monthlyIncome - monthlyCosts;
  const yearlyCosts = monthlyCosts * 12;
  const yearlyIncome = monthlyIncome * 12;
  const yearlyProfit = yearlyIncome - yearlyCosts;

  // Calculate weighted projections (based on confidence)
  const weightedMonthlyIncome = activeIncomeItems.reduce((sum, item) => {
    const weight = CONFIDENCE_CONFIG[item.confidence || 'confirmed'].weight;
    return sum + (getMonthlyAmount(item) * weight);
  }, 0);

  // Calculate actual data from invoices (current year)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  const currentDate = new Date();
  const daysInYear = 365;
  const dayOfYear = Math.floor((currentDate.getTime() - new Date(currentYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24));
  const yearProgress = dayOfYear / daysInYear; // 0 tot 1
  const remainingProgress = 1 - yearProgress;

  const actualYTDIncome = outgoingInvoices
    .filter(inv => {
      const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
      return invDate.getFullYear() === currentYear && inv.status !== 'cancelled';
    })
    .reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);

  // Calculate personnel costs from payroll (YTD)
  const actualYTDPersonnelCosts = payrollCalculations
    .filter(calc => {
      const calcDate = calc.periodStartDate instanceof Date ? calc.periodStartDate : new Date(calc.periodStartDate);
      return calcDate.getFullYear() === currentYear;
    })
    .reduce((sum, calc) => sum + (calc.grossPay || 0), 0);

  // Calculate invoice costs (YTD)
  const actualYTDInvoiceCosts = incomingInvoices
    .filter(inv => {
      const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
      return invDate.getFullYear() === currentYear;
    })
    .reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);

  // Total actual costs (invoices + personnel)
  const actualYTDCosts = actualYTDInvoiceCosts + actualYTDPersonnelCosts;

  // Projected for FULL YEAR based on budget items
  const projectedFullYearIncome = weightedMonthlyIncome * 12;
  const projectedFullYearCosts = monthlyCosts * 12;

  // What we SHOULD have had YTD based on budget
  const projectedYTDIncome = projectedFullYearIncome * yearProgress;
  const projectedYTDCosts = projectedFullYearCosts * yearProgress;

  // Projected for remaining period
  const projectedRemainingIncome = projectedFullYearIncome * remainingProgress;
  const projectedRemainingCosts = projectedFullYearCosts * remainingProgress;

  // Full year forecast: actual YTD + projected remaining
  const forecastFullYearIncome = actualYTDIncome + projectedRemainingIncome;
  const forecastFullYearCosts = actualYTDCosts + projectedRemainingCosts;

  // Variances
  const incomeVariance = actualYTDIncome - projectedYTDIncome;
  const costVariance = actualYTDCosts - projectedYTDCosts;

  // Helper to safely convert date to ISO string
  const toDateString = (date: any): string => {
    if (!date) return new Date().toISOString().split('T')[0];
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    if (date.toDate && typeof date.toDate === 'function') {
      return date.toDate().toISOString().split('T')[0];
    }
    try {
      return new Date(date).toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  const handleOpenModal = (item?: BudgetItem, type?: BudgetType) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        type: item.type || 'cost',
        name: item.name,
        category: item.category,
        amount: item.amount.toString(),
        frequency: item.frequency,
        startDate: toDateString(item.startDate),
        endDate: item.endDate ? toDateString(item.endDate) : '',
        supplier: item.supplier || '',
        contractNumber: item.contractNumber || '',
        notes: item.notes || '',
        isActive: item.isActive,
        confidence: item.confidence || 'confirmed',
        growthRate: (item.growthRate || 0).toString(),
      });
    } else {
      setEditingItem(null);
      setFormData({
        ...initialFormData,
        type: type || 'cost',
        category: type === 'income' ? 'services' : 'software',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompany) return;

    if (!formData.name.trim()) {
      showError('Validatiefout', 'Naam is verplicht');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      showError('Validatiefout', 'Voer een geldig bedrag in');
      return;
    }

    setSaving(true);
    try {
      const itemData = {
        type: formData.type,
        name: formData.name.trim(),
        category: formData.category,
        amount: parseFloat(formData.amount),
        frequency: formData.frequency,
        startDate: new Date(formData.startDate),
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        supplier: formData.supplier.trim() || undefined,
        contractNumber: formData.contractNumber.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        isActive: formData.isActive,
        confidence: formData.confidence,
        growthRate: parseFloat(formData.growthRate) || 0,
        companyId: selectedCompany.id,
      };

      if (editingItem) {
        await updateBudgetItem(editingItem.id, itemData, adminUserId);
        success('Bijgewerkt', 'Item is bijgewerkt');
      } else {
        await createBudgetItem(itemData, adminUserId);
        success('Toegevoegd', 'Item is toegevoegd');
      }

      handleCloseModal();
      await loadData();
    } catch (error) {
      console.error('Error saving:', error);
      showError('Fout bij opslaan', 'Kon item niet opslaan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: BudgetItem) => {
    if (!user || !adminUserId) return;

    if (window.confirm(`Weet je zeker dat je "${item.name}" wilt verwijderen?`)) {
      try {
        await deleteBudgetItem(item.id, adminUserId);
        success('Verwijderd', 'Item is verwijderd');
        await loadData();
      } catch (error) {
        console.error('Error deleting:', error);
        showError('Fout bij verwijderen', 'Kon item niet verwijderen');
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyDetailed = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Generate REALITY projections based on actual invoices only
  // Generate Investment PDF

  const generateRealityProjections = () => {
    const projections = [];
    const now = new Date();

    for (let year = 0; year < projectionYears; year++) {
      const projYear = now.getFullYear() + year;
      
      // Get invoices for this year
      const yearInvoices = outgoingInvoices.filter(inv => {
        const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
        return invDate.getFullYear() === projYear && inv.status !== 'cancelled';
      });

      const yearCostsInvoices = incomingInvoices.filter(inv => {
        const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
        return invDate.getFullYear() === projYear;
      });

      const yearIncome = yearInvoices.reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);
      const yearCosts = yearCostsInvoices.reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);

      projections.push({
        year: projYear,
        income: yearIncome,
        costs: yearCosts,
        profit: yearIncome - yearCosts,
      });
    }

    return projections;
  };

  // Generate BUDGET projections based on budget items only
  const generateBudgetProjections = () => {
    const projections = [];
    const now = new Date();

    for (let year = 0; year < projectionYears; year++) {
      const projYear = now.getFullYear() + year;
      
      // Budget-based calculations
      let yearIncome = activeIncomeItems.reduce((sum, item) => {
        const baseMonthly = getMonthlyAmount(item);
        const growth = item.growthRate || 0;
        const yearlyAmount = baseMonthly * 12 * Math.pow(1 + growth / 100, year);
        const weight = CONFIDENCE_CONFIG[item.confidence || 'confirmed'].weight;
        return sum + (yearlyAmount * weight);
      }, 0);

      let yearCosts = activeCostItems.reduce((sum, item) => {
        const baseMonthly = getMonthlyAmount(item);
        const growth = item.growthRate || 0;
        return sum + (baseMonthly * 12 * Math.pow(1 + growth / 100, year));
      }, 0);

      projections.push({
        year: projYear,
        income: yearIncome,
        costs: yearCosts,
        profit: yearIncome - yearCosts,
      });
    }

    return projections;
  };

  // Export to HTML file (downloadable)
  const handleExport = () => {
    const realityProjections = generateRealityProjections();
    const budgetProjections = generateBudgetProjections();
    const companyName = selectedCompany?.name || 'Bedrijf';
    const dateStr = new Date().toLocaleDateString('nl-NL');
    const fileName = `Financiele-Projectie-${companyName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.html`;

    const html = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Financiële Projectie - ${companyName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      color: #1a1a1a;
      background: white;
      max-width: 1200px;
      margin: 0 auto;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .print-btn:hover { background: #4338ca; }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px solid #4f46e5;
      padding-bottom: 20px;
    }
    .header h1 { font-size: 32px; color: #4f46e5; margin-bottom: 8px; }
    .header p { color: #666; font-size: 14px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }
    .summary-card {
      padding: 24px;
      border-radius: 12px;
      text-align: center;
    }
    .summary-card.income { background: linear-gradient(135deg, #ecfdf5, #d1fae5); }
    .summary-card.costs { background: linear-gradient(135deg, #fef2f2, #fecaca); }
    .summary-card.profit { background: linear-gradient(135deg, #eef2ff, #c7d2fe); }
    .summary-card h3 { font-size: 14px; color: #666; margin-bottom: 8px; }
    .summary-card .amount { font-size: 28px; font-weight: 700; }
    .summary-card.income .amount { color: #059669; }
    .summary-card.costs .amount { color: #dc2626; }
    .summary-card.profit .amount { color: #4f46e5; }
    .section { margin-bottom: 40px; }
    .section h2 {
      font-size: 20px;
      color: #1a1a1a;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    .projection-row { background: #f9fafb; }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-top: 20px;
    }
    .metric-card {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .metric-card .value { font-size: 24px; font-weight: 700; color: #1a1a1a; }
    .metric-card .label { font-size: 12px; color: #666; margin-top: 4px; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
    }
    @media print {
      .print-btn { display: none; }
      body { padding: 20px; }
    }
    @media (max-width: 768px) {
      .summary-grid { grid-template-columns: 1fr; }
      .metrics-grid { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Print / PDF</button>

  <div class="header">
    <h1>${companyName}</h1>
    <p>Financiële Projectie & Begroting | Gegenereerd op ${dateStr}</p>
  </div>

  <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 16px; border-radius: 12px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
    <h3 style="font-size: 16px; font-weight: 600; color: #92400e; margin-bottom: 8px;">📊 Realiteit vs Prognose</h3>
    <p style="font-size: 14px; color: #78350f; line-height: 1.5;">
      <strong>REALITEIT:</strong> Gebaseerd op werkelijke in- en uitgaande facturen (Inkomsten = uitgaande facturen, Kosten = inkomende facturen).<br>
      <strong>PROGNOSE:</strong> Gebaseerd op budget items met gewogen zekerheid en groeipercentages.
    </p>
  </div>

  <div class="summary-grid">
    <div class="summary-card income">
      <h3>Jaarlijkse Inkomsten</h3>
      <div class="amount">${formatCurrency(yearlyIncome)}</div>
    </div>
    <div class="summary-card costs">
      <h3>Jaarlijkse Kosten</h3>
      <div class="amount">${formatCurrency(yearlyCosts)}</div>
    </div>
    <div class="summary-card profit">
      <h3>Verwachte Winst</h3>
      <div class="amount">${formatCurrency(yearlyProfit)}</div>
    </div>
  </div>

  <div class="section">
    <h2>Kerngetallen</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="value">${formatCurrency(yearlyIncome)}</div>
        <div class="label">ARR</div>
      </div>
      <div class="metric-card">
        <div class="value">${formatCurrency(monthlyIncome)}</div>
        <div class="label">MRR</div>
      </div>
      <div class="metric-card">
        <div class="value" style="color: ${yearlyProfit >= 0 ? '#059669' : '#dc2626'}">${yearlyIncome > 0 ? ((yearlyProfit / yearlyIncome) * 100).toFixed(1) : 0}%</div>
        <div class="label">Winstmarge</div>
      </div>
      <div class="metric-card">
        <div class="value">${outgoingInvoices.length}</div>
        <div class="label">Uitgaande Facturen</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>📊 Realiteit - Meerjarenprojectie (Werkelijke Facturen)</h2>
    <p style="font-size: 13px; color: #666; margin-bottom: 12px;">Gebaseerd op werkelijke in- en uitgaande facturen</p>
    <table>
      <thead>
        <tr>
          <th>Jaar</th>
          <th>Inkomsten</th>
          <th>Kosten</th>
          <th>Resultaat</th>
          <th>Marge</th>
        </tr>
      </thead>
      <tbody>
        ${realityProjections.map(p => `
          <tr class="projection-row">
            <td><strong>${p.year}</strong></td>
            <td class="positive">${formatCurrency(p.income)}</td>
            <td class="negative">${formatCurrency(p.costs)}</td>
            <td class="${p.profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(p.profit)}</td>
            <td class="${p.profit >= 0 ? 'positive' : 'negative'}">${p.income > 0 ? ((p.profit / p.income) * 100).toFixed(1) : 0}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>📈 Prognose - Meerjarenprojectie (Budget Items)</h2>
    <p style="font-size: 13px; color: #666; margin-bottom: 12px;">Gebaseerd op budget items met gewogen zekerheid en groeipercentages</p>
    <table>
      <thead>
        <tr>
          <th>Jaar</th>
          <th>Inkomsten</th>
          <th>Kosten</th>
          <th>Resultaat</th>
          <th>Marge</th>
        </tr>
      </thead>
      <tbody>
        ${budgetProjections.map(p => `
          <tr class="projection-row">
            <td><strong>${p.year}</strong></td>
            <td class="positive">${formatCurrency(p.income)}</td>
            <td class="negative">${formatCurrency(p.costs)}</td>
            <td class="${p.profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(p.profit)}</td>
            <td class="${p.profit >= 0 ? 'positive' : 'negative'}">${p.income > 0 ? ((p.profit / p.income) * 100).toFixed(1) : 0}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>Dit document is automatisch gegenereerd en bevat financiële projecties gebaseerd op werkelijke in- en uitgaande facturen.</p>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    success('Gedownload', `${fileName} is gedownload`);
  };

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Geen bedrijf geselecteerd"
        description="Selecteer een bedrijf om de begroting te beheren"
      />
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6 pb-20" ref={exportRef}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="hidden lg:block text-2xl font-bold text-gray-900 dark:text-gray-100">Begroting & Projecties</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            Financieel overzicht voor {selectedCompany.name}
          </p>
        </div>

        {/* Desktop Buttons (md and up) */}
        <div className="hidden md:flex gap-2">
          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={refreshing}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Ververs
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsPitchDeckOpen(true)}
            size="sm"
            className="text-blue-600 hover:bg-blue-50"
          >
            <Briefcase className="h-4 w-4 mr-2" />
            Pitch Deck
          </Button>
          <Button variant="secondary" onClick={handleExport} size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exporteer
          </Button>
          <Button 
            onClick={() => handleOpenModal(undefined, activeTab === 'income' ? 'income' : 'cost')}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nieuw Item
          </Button>
        </div>

        {/* Mobile Buttons (below md) - Icons only */}
        <div className="flex md:hidden gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Ververs"
          >
            <RefreshCw className={`h-5 w-5 text-gray-600 dark:text-gray-300 dark:text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsPitchDeckOpen(true)}
            className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
            title="Pitch Deck"
          >
            <Briefcase className="h-5 w-5 text-blue-600" />
          </button>
          <button
            onClick={handleExport}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Exporteer"
          >
            <Download className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
          <button
            onClick={() => handleOpenModal(undefined, activeTab === 'income' ? 'income' : 'cost')}
            className="p-2 hover:bg-primary-50 rounded-lg transition-colors"
            title="Nieuw Item"
          >
            <Plus className="h-5 w-5 text-primary-600" />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2 overflow-x-auto">
        {[
          { id: 'overview' as ViewTab, label: 'Overzicht', icon: PieChart },
          { id: 'costs' as ViewTab, label: `Kosten (${costItems.length})`, icon: TrendingDown },
          { id: 'income' as ViewTab, label: `Inkomsten (${incomeItems.length})`, icon: TrendingUp },
          { id: 'projections' as ViewTab, label: 'Projecties', icon: BarChart3 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${ activeTab === tab.id ? 'bg-primary-600 text-white' : 'text-gray-600 dark:text-gray-300 dark:text-gray-500 hover:bg-gray-100 dark:bg-gray-800' }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Variance Alerts */}
          {(Math.abs(incomeVariance / projectedYTDIncome) > 0.15 || Math.abs(costVariance / projectedYTDCosts) > 0.15) && (
            <Card className="p-4 bg-amber-50 dark:bg-gray-800 border-amber-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900">Significante Afwijkingen Gedetecteerd</h3>
                  <div className="mt-2 space-y-1 text-sm text-amber-800">
                    {Math.abs(incomeVariance / projectedYTDIncome) > 0.15 && (
                      <p>
                        • Inkomsten wijken {((incomeVariance / projectedYTDIncome) * 100).toFixed(1)}% af van projectie
                        {incomeVariance > 0 ? ' (hoger dan verwacht ✓)' : ' (lager dan verwacht ⚠️)'}
                      </p>
                    )}
                    {Math.abs(costVariance / projectedYTDCosts) > 0.15 && (
                      <p>
                        • Kosten wijken {((costVariance / projectedYTDCosts) * 100).toFixed(1)}% af van projectie
                        {costVariance < 0 ? ' (lager dan verwacht ✓)' : ' (hoger dan verwacht ⚠️)'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Main Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-gray-800 dark:to-gray-800 border-emerald-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-600">Maandelijkse Inkomsten</p>
                  <p className="text-3xl font-bold text-emerald-900 mt-1">
                    {formatCurrency(monthlyIncome)}
                  </p>
                  <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {activeIncomeItems.length} bronnen
                  </p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <ArrowUpRight className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-red-50 to-rose-50 dark:from-gray-800 dark:to-gray-800 border-red-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Maandelijkse Kosten</p>
                  <p className="text-3xl font-bold text-red-900 mt-1">
                    {formatCurrency(monthlyCosts)}
                  </p>
                  <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" />
                    {activeCostItems.length} posten
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-xl">
                  <ArrowDownRight className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </Card>

            <Card className={`p-6 dark:from-gray-800 dark:to-gray-800 dark:border-gray-700 ${monthlyProfit >= 0 ? 'bg-gradient-to-br from-primary-50 to-indigo-50 border-primary-200' : 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-sm font-medium ${monthlyProfit >= 0 ? 'text-primary-600' : 'text-orange-600'}`}>
                    Maandelijks Resultaat
                  </p>
                  <p className={`text-3xl font-bold mt-1 ${monthlyProfit >= 0 ? 'text-primary-900' : 'text-orange-900'}`}>
                    {monthlyProfit >= 0 ? '+' : ''}{formatCurrency(monthlyProfit)}
                  </p>
                  <p className={`text-xs mt-2 ${monthlyProfit >= 0 ? 'text-primary-600' : 'text-orange-600'}`}>
                    {formatCurrency(yearlyProfit)}/jaar
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${monthlyProfit >= 0 ? 'bg-primary-100' : 'bg-orange-100'}`}>
                  <Wallet className={`h-6 w-6 ${monthlyProfit >= 0 ? 'text-primary-600' : 'text-orange-600'}`} />
                </div>
              </div>
            </Card>
          </div>

          {/* Reality Check Section */}
          {showActualData && (actualYTDIncome > 0 || actualYTDCosts > 0) && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Realiteit vs Projectie ({currentYear} YTD)
                </h2>
                <button
                  onClick={() => setShowActualData(!showActualData)}
                  className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 rounded-lg hover:bg-gray-100"
                >
                  {showActualData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Income Comparison */}
                <div className="p-4 bg-emerald-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-emerald-700">Inkomsten (Uitgaande Facturen)</span>
                    <span className={`text-sm font-bold ${incomeVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {incomeVariance >= 0 ? '+' : ''}{formatCurrency(incomeVariance)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-300">Geprojecteerd</span>
                      <span className="font-medium">{formatCurrency(projectedYTDIncome)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-300">Werkelijk</span>
                      <span className="font-medium text-emerald-700">{formatCurrency(actualYTDIncome)}</span>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-emerald-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min((actualYTDIncome / projectedYTDIncome) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Costs Comparison */}
                <div className="p-4 bg-red-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-red-700">Kosten (Inkomende Facturen)</span>
                    <span className={`text-sm font-bold ${costVariance <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {costVariance >= 0 ? '+' : ''}{formatCurrency(costVariance)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-300">Geprojecteerd</span>
                      <span className="font-medium">{formatCurrency(projectedYTDCosts)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-300">Werkelijk</span>
                      <span className="font-medium text-red-700">{formatCurrency(actualYTDCosts)}</span>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-red-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${Math.min((actualYTDCosts / projectedYTDCosts) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleOpenModal(undefined, 'income')}
              className="p-4 bg-emerald-50 border-2 border-dashed border-emerald-300 rounded-xl hover:bg-emerald-100 transition-colors"
            >
              <Plus className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-emerald-700">Inkomstenbron Toevoegen</p>
            </button>
            <button
              onClick={() => handleOpenModal(undefined, 'cost')}
              className="p-4 bg-red-50 border-2 border-dashed border-red-300 rounded-xl hover:bg-red-100 transition-colors"
            >
              <Plus className="h-6 w-6 text-red-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-red-700">Kostenpost Toevoegen</p>
            </button>
          </div>
        </div>
      )}

      {/* Costs Tab */}
      {activeTab === 'costs' && (
        <div className="space-y-6">
          {costItems.length === 0 && incomingInvoices.length === 0 ? (
            <EmptyState
              icon={TrendingDown}
              title="Geen kosten"
              description="Voeg terugkerende kosten toe"
              actionLabel="Eerste Kost Toevoegen"
              onAction={() => handleOpenModal(undefined, 'cost')}
            />
          ) : (
            <>
              {/* GEPLANDE KOSTEN SECTIE */}
              {costItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">📋 Geplande Kosten (Budget Items)</h2>
                    <div className="text-sm text-gray-500 dark:text-gray-300">
                      Totaal: <span className="font-bold text-red-600">{formatCurrency(monthlyCosts)}/mnd</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(
                      costItems.reduce((groups, item) => {
                        const category = item.category as BudgetCostCategory;
                        if (!groups[category]) groups[category] = [];
                        groups[category].push(item);
                        return groups;
                      }, {} as Record<BudgetCostCategory, BudgetItem[]>)
                    ).map(([category, items]) => {
                      const config = COST_CATEGORY_CONFIG[category as BudgetCostCategory] || COST_CATEGORY_CONFIG.other;
                      const Icon = config.icon;
                      const categoryTotal = items.reduce((sum, item) => sum + (item.isActive ? getMonthlyAmount(item) : 0), 0);
                      const isExpanded = expandedCategories.has(`planned-cost-${category}`);

                      return (
                        <div key={category} className="space-y-2">
                          {/* Category Header */}
                          <button
                            onClick={() => toggleCategory(`planned-cost-${category}`)}
                            className={`w-full flex items-center justify-between p-3 rounded-lg ${config.bgColor} border ${config.borderColor} transition-all hover:shadow-md`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className={`h-5 w-5 ${config.textColor}`} />
                              <h3 className={`font-semibold ${config.textColor}`}>{config.label}</h3>
                              <span className="text-xs text-gray-500 dark:text-gray-300">({items.length} items)</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className={`text-sm font-bold ${config.textColor}`}>
                                  {formatCurrency(categoryTotal)}/mnd
                                </p>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className={`h-4 w-4 ${config.textColor}`} />
                              ) : (
                                <ChevronDown className={`h-4 w-4 ${config.textColor}`} />
                              )}
                            </div>
                          </button>

                          {/* Items */}
                          {isExpanded && (
                            <div className="space-y-2 pl-2">
                              {items.map((item) => (
                                <Card key={item.id} className={`p-4 ${!item.isActive ? 'opacity-60' : ''}`}>
                                  <div className="flex items-center gap-4">
                                    <div className={`p-2.5 rounded-lg ${config.bgColor} ${config.textColor}`}>
                                      <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</h4>
                                        {!item.isActive && (
                                          <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 dark:text-gray-300 rounded">
                                            Inactief
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-300 mt-0.5">
                                        {item.supplier && <span>{item.supplier}</span>}
                                        {item.contractNumber && <span>• Contract: {item.contractNumber}</span>}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-lg font-bold text-red-600">
                                        -{formatCurrencyDetailed(item.amount)}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-300">{FREQUENCY_LABELS[item.frequency]}</p>
                                    </div>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => handleOpenModal(item)}
                                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                        title="Bewerken"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDelete(item)}
                                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Verwijderen"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PERSONEELSKOSTEN SECTIE (alleen voor employer bedrijven) */}
              {selectedCompany?.companyType === 'employer' && payrollCalculations.filter(calc => {
                const calcDate = calc.periodStartDate instanceof Date ? calc.periodStartDate : new Date(calc.periodStartDate);
                return calcDate.getFullYear() === currentYear;
              }).length > 0 && (
                <div className="mt-8 pt-8 border-t-4 border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">💼 Personeelskosten (uit Salarisverwerking {currentYear})</h2>
                    <div className="text-sm text-gray-500 dark:text-gray-300">
                      Totaal YTD: <span className="font-bold text-red-600">{formatCurrency(actualYTDPersonnelCosts)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* Group payroll by month */}
                    {Object.entries(
                      payrollCalculations
                        .filter(calc => {
                          const calcDate = calc.periodStartDate instanceof Date ? calc.periodStartDate : new Date(calc.periodStartDate);
                          return calcDate.getFullYear() === currentYear;
                        })
                        .reduce((groups, calc) => {
                          const calcDate = calc.periodStartDate instanceof Date ? calc.periodStartDate : new Date(calc.periodStartDate);
                          const monthKey = `${calcDate.getFullYear()}-${String(calcDate.getMonth() + 1).padStart(2, '0')}`;
                          const monthName = calcDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
                          if (!groups[monthKey]) groups[monthKey] = { name: monthName, calcs: [] };
                          groups[monthKey].calcs.push(calc);
                          return groups;
                        }, {} as Record<string, { name: string, calcs: any[] }>)
                    ).sort((a, b) => b[0].localeCompare(a[0])).map(([monthKey, { name: monthName, calcs }]) => {
                      const config = COST_CATEGORY_CONFIG.personnel;
                      const Icon = config.icon;
                      const monthTotal = calcs.reduce((sum, calc) => sum + (calc.grossPay || 0), 0);
                      const isExpanded = expandedCategories.has(`payroll-${monthKey}`);

                      return (
                        <div key={monthKey} className="space-y-2">
                          <button
                            onClick={() => toggleCategory(`payroll-${monthKey}`)}
                            className={`w-full flex items-center justify-between p-3 rounded-lg ${config.bgColor} border-2 ${config.borderColor} transition-all hover:shadow-md`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className={`h-5 w-5 ${config.textColor}`} />
                              <h3 className={`font-semibold ${config.textColor}`}>{monthName}</h3>
                              <span className="text-xs text-gray-500 dark:text-gray-300">({calcs.length} medewerker{calcs.length !== 1 ? 's' : ''})</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className={`text-sm font-bold ${config.textColor}`}>
                                  {formatCurrency(monthTotal)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-300">Bruto Loon</p>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className={`h-4 w-4 ${config.textColor}`} />
                              ) : (
                                <ChevronDown className={`h-4 w-4 ${config.textColor}`} />
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="space-y-2 pl-2">
                              {calcs.map((calc: any) => (
                                <Card key={calc.id} className="p-3 bg-white dark:bg-gray-800">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900 dark:text-gray-100">{calc.employeeName || 'Medewerker'}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-300">
                                        Periode: {calc.periodStartDate instanceof Date
                                          ? calc.periodStartDate.toLocaleDateString('nl-NL')
                                          : new Date(calc.periodStartDate).toLocaleDateString('nl-NL')} - {calc.periodEndDate instanceof Date
                                          ? calc.periodEndDate.toLocaleDateString('nl-NL')
                                          : new Date(calc.periodEndDate).toLocaleDateString('nl-NL')}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-bold text-red-600 text-lg">
                                        {formatCurrency(calc.grossPay || 0)}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-300">Bruto</p>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* WERKELIJKE KOSTEN SECTIE */}
              {incomingInvoices.filter(inv => {
                const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
                return invDate.getFullYear() === currentYear;
              }).length > 0 && (
                <div className="mt-8 pt-8 border-t-4 border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">💰 Werkelijke Kosten (Inkomende Facturen {currentYear})</h2>
                    <div className="text-sm text-gray-500 dark:text-gray-300">
                      Totaal YTD: <span className="font-bold text-red-600">{formatCurrency(actualYTDCosts)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(
                      incomingInvoices
                        .filter(inv => {
                          const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
                          return invDate.getFullYear() === currentYear;
                        })
                        .reduce((groups, inv) => {
                          const category = matchInvoiceToCategory(inv, 'cost') || 'other';
                          if (!groups[category]) groups[category] = [];
                          groups[category].push(inv);
                          return groups;
                        }, {} as Record<string, any[]>)
                    ).map(([category, invoices]) => {
                      const config = COST_CATEGORY_CONFIG[category as BudgetCostCategory] || COST_CATEGORY_CONFIG.other;
                      const Icon = config.icon;
                      const categoryTotal = invoices.reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);
                      const isExpanded = expandedCategories.has(`actual-cost-${category}`);

                      return (
                        <div key={category} className="space-y-2">
                          <button
                            onClick={() => toggleCategory(`actual-cost-${category}`)}
                            className={`w-full flex items-center justify-between p-3 rounded-lg ${config.bgColor} border-2 ${config.borderColor} transition-all hover:shadow-md`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className={`h-5 w-5 ${config.textColor}`} />
                              <h3 className={`font-semibold ${config.textColor}`}>{config.label}</h3>
                              <span className="text-xs text-gray-500 dark:text-gray-300">({invoices.length} facturen)</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className={`text-sm font-bold ${config.textColor}`}>
                                  {formatCurrency(categoryTotal)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-300">YTD</p>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className={`h-4 w-4 ${config.textColor}`} />
                              ) : (
                                <ChevronDown className={`h-4 w-4 ${config.textColor}`} />
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="space-y-2 pl-2">
                              {invoices.map((inv: any) => {
                                const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
                                return (
                                  <Card key={inv.id} className="p-3 bg-white dark:bg-gray-800">
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <p className="font-medium text-gray-900 dark:text-gray-100">{inv.supplier || inv.description || 'Onbekend'}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-300">
                                          {invDate.toLocaleDateString('nl-NL')} • {inv.invoiceNumber || 'Geen nr'}
                                        </p>
                                      </div>
                                      <p className="font-bold text-red-600 text-lg">
                                        {formatCurrency(inv.totalAmount || inv.amount || 0)}
                                      </p>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Income Tab */}
      {activeTab === 'income' && (
        <div className="space-y-6">
          {incomeItems.length === 0 && outgoingInvoices.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Geen inkomsten"
              description="Voeg verwachte inkomsten toe voor projecties"
              actionLabel="Eerste Inkomst Toevoegen"
              onAction={() => handleOpenModal(undefined, 'income')}
            />
          ) : (
            <>
              {/* GEPLANDE INKOMSTEN SECTIE */}
              {incomeItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">📋 Geplande Inkomsten (Budget Items)</h2>
                    <div className="text-sm text-gray-500 dark:text-gray-300">
                      Totaal: <span className="font-bold text-emerald-600">{formatCurrency(monthlyIncome)}/mnd</span>
                      <span className="mx-2">•</span>
                      Gewogen: <span className="font-bold text-emerald-600">{formatCurrency(weightedMonthlyIncome)}/mnd</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(
                      incomeItems.reduce((groups, item) => {
                        const category = item.category as BudgetIncomeCategory;
                        if (!groups[category]) groups[category] = [];
                        groups[category].push(item);
                        return groups;
                      }, {} as Record<BudgetIncomeCategory, BudgetItem[]>)
                    ).map(([category, items]) => {
                      const config = INCOME_CATEGORY_CONFIG[category as BudgetIncomeCategory] || INCOME_CATEGORY_CONFIG.other;
                      const Icon = config.icon;
                      const categoryTotal = items.reduce((sum, item) => sum + (item.isActive ? getMonthlyAmount(item) : 0), 0);
                      const weightedTotal = items.reduce((sum, item) => {
                        if (!item.isActive) return sum;
                        const weight = CONFIDENCE_CONFIG[item.confidence || 'confirmed'].weight;
                        return sum + (getMonthlyAmount(item) * weight);
                      }, 0);
                      const isExpanded = expandedCategories.has(`planned-income-${category}`);

                      return (
                        <div key={category} className="space-y-2">
                          {/* Category Header */}
                          <button
                            onClick={() => toggleCategory(`planned-income-${category}`)}
                            className={`w-full flex items-center justify-between p-3 rounded-lg ${config.bgColor} border ${config.borderColor} transition-all hover:shadow-md`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className={`h-5 w-5 ${config.textColor}`} />
                              <h3 className={`font-semibold ${config.textColor}`}>{config.label}</h3>
                              <span className="text-xs text-gray-500 dark:text-gray-300">({items.length} items)</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className={`text-sm font-bold ${config.textColor}`}>
                                  {formatCurrency(categoryTotal)}/mnd
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-300">
                                  Gewogen: {formatCurrency(weightedTotal)}/mnd
                                </p>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className={`h-4 w-4 ${config.textColor}`} />
                              ) : (
                                <ChevronDown className={`h-4 w-4 ${config.textColor}`} />
                              )}
                            </div>
                          </button>

                          {/* Items */}
                          {isExpanded && (
                            <div className="space-y-2 pl-2">
                              {items.map((item) => {
                                const confConfig = CONFIDENCE_CONFIG[item.confidence || 'confirmed'];
                                const ConfIcon = confConfig.icon;

                                return (
                                  <Card key={item.id} className={`p-4 ${!item.isActive ? 'opacity-60' : ''}`}>
                                    <div className="flex items-center gap-4">
                                      <div className={`p-2.5 rounded-lg ${config.bgColor} ${config.textColor}`}>
                                        <Icon className="h-5 w-5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</h4>
                                          <span className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 ${confConfig.bgColor} ${confConfig.color}`}>
                                            <ConfIcon className="h-3 w-3" />
                                            {confConfig.label}
                                          </span>
                                          {!item.isActive && (
                                            <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 dark:text-gray-300 rounded">
                                              Inactief
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-300 mt-0.5">
                                          {item.supplier && <span>{item.supplier}</span>}
                                          {item.contractNumber && <span>• Contract: {item.contractNumber}</span>}
                                          {item.growthRate && item.growthRate > 0 && (
                                            <span className="text-emerald-600">• +{item.growthRate}%/jaar</span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-lg font-bold text-emerald-600">
                                          +{formatCurrencyDetailed(item.amount)}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-300">{FREQUENCY_LABELS[item.frequency]}</p>
                                      </div>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => handleOpenModal(item)}
                                          className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                          title="Bewerken"
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => handleDelete(item)}
                                          className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                          title="Verwijderen"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* WERKELIJKE INKOMSTEN SECTIE */}
              {outgoingInvoices.filter(inv => {
                const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
                return invDate.getFullYear() === currentYear && inv.status !== 'cancelled';
              }).length > 0 && (
                <div className="mt-8 pt-8 border-t-4 border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">💰 Werkelijke Inkomsten (Uitgaande Facturen {currentYear})</h2>
                    <div className="text-sm text-gray-500 dark:text-gray-300">
                      Totaal YTD: <span className="font-bold text-emerald-600">{formatCurrency(actualYTDIncome)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(
                      outgoingInvoices
                        .filter(inv => {
                          const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
                          return invDate.getFullYear() === currentYear && inv.status !== 'cancelled';
                        })
                        .reduce((groups, inv) => {
                          const category = matchInvoiceToCategory(inv, 'income') || 'services';
                          if (!groups[category]) groups[category] = [];
                          groups[category].push(inv);
                          return groups;
                        }, {} as Record<string, any[]>)
                    ).map(([category, invoices]) => {
                      const config = INCOME_CATEGORY_CONFIG[category as BudgetIncomeCategory] || INCOME_CATEGORY_CONFIG.other;
                      const Icon = config.icon;
                      const categoryTotal = invoices.reduce((sum, inv) => sum + (inv.totalAmount || inv.amount || 0), 0);
                      const isExpanded = expandedCategories.has(`actual-income-${category}`);

                      return (
                        <div key={category} className="space-y-2">
                          <button
                            onClick={() => toggleCategory(`actual-income-${category}`)}
                            className={`w-full flex items-center justify-between p-3 rounded-lg ${config.bgColor} border-2 ${config.borderColor} transition-all hover:shadow-md`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className={`h-5 w-5 ${config.textColor}`} />
                              <h3 className={`font-semibold ${config.textColor}`}>{config.label}</h3>
                              <span className="text-xs text-gray-500 dark:text-gray-300">({invoices.length} facturen)</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className={`text-sm font-bold ${config.textColor}`}>
                                  {formatCurrency(categoryTotal)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-300">YTD</p>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className={`h-4 w-4 ${config.textColor}`} />
                              ) : (
                                <ChevronDown className={`h-4 w-4 ${config.textColor}`} />
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="space-y-2 pl-2">
                              {invoices.map((inv: any) => {
                                const invDate = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
                                return (
                                  <Card key={inv.id} className="p-3 bg-white dark:bg-gray-800">
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <p className="font-medium text-gray-900 dark:text-gray-100">{inv.clientName || inv.description || 'Onbekend'}</p>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-300">
                                          <span>{invDate.toLocaleDateString('nl-NL')}</span>
                                          <span>• {inv.invoiceNumber || 'Geen nr'}</span>
                                          {inv.status && (
                                            <>
                                              <span>•</span>
                                              <span className={`font-medium ${ inv.status === 'paid' ? 'text-green-600' : inv.status === 'sent' ? 'text-blue-600' : 'text-gray-600 dark:text-gray-300 dark:text-gray-500' }`}>
                                                {inv.status === 'paid' ? 'Betaald' :
                                                 inv.status === 'sent' ? 'Verzonden' :
                                                 inv.status === 'draft' ? 'Concept' : inv.status}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      <p className="font-bold text-emerald-600 text-lg">
                                        {formatCurrency(inv.totalAmount || inv.amount || 0)}
                                      </p>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Projections Tab */}
      {activeTab === 'projections' && (
        <div className="space-y-6">
          {/* Header met uitleg en controls */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Meerjarenprojecties</h2>
                <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">Vergelijk werkelijke cijfers met budget prognoses</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-300">Jaren:</span>
                {[1, 3, 5].map(years => (
                  <button
                    key={years}
                    onClick={() => setProjectionYears(years)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${ projectionYears === years ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 dark:text-gray-500 hover:bg-gray-200' }`}
                  >
                    {years}
                  </button>
                ))}
              </div>
            </div>

            <Card className="p-4 bg-gradient-to-r from-emerald-50 to-primary-50 dark:from-gray-800 dark:to-gray-800 border-l-4 border-l-emerald-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                    <h4 className="font-bold text-emerald-900">📊 REALITEIT (Werkelijk)</h4>
                  </div>
                  <p className="text-sm text-emerald-800">
                    Gebaseerd op daadwerkelijk verstuurde en ontvangen facturen
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                    <h4 className="font-bold text-primary-900">📈 PROGNOSE (Gepland)</h4>
                  </div>
                  <p className="text-sm text-primary-800">
                    Gebaseerd op geplande budget items met zekerheid & groei
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Vergelijking huidige jaar - met YTD, Forecast en Budget */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* YTD WERKELIJK */}
            <Card className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-gray-800 dark:to-gray-800 border-2 border-emerald-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-4 h-4 bg-emerald-500 rounded-full"></div>
                <h3 className="text-lg font-bold text-emerald-900">📊 YTD {currentYear}</h3>
                <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-1 rounded">
                  {Math.round(yearProgress * 100)}% van jaar
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Inkomsten</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(actualYTDIncome)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Kosten</span>
                  <span className="font-bold text-red-600">{formatCurrency(actualYTDCosts)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-emerald-100 rounded-lg border-2 border-emerald-300">
                  <span className="text-emerald-900 font-bold text-sm">Resultaat</span>
                  <span className={`font-bold ${(actualYTDIncome - actualYTDCosts) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatCurrency(actualYTDIncome - actualYTDCosts)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-300 text-center mt-2">
                  Werkelijk tot vandaag
                </div>
              </div>
            </Card>

            {/* FORECAST VOLLEDIG JAAR */}
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border-2 border-blue-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                <h3 className="text-lg font-bold text-blue-900">🔮 Forecast {currentYear}</h3>
                <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                  Volledig jaar
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Inkomsten</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(forecastFullYearIncome)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Kosten</span>
                  <span className="font-bold text-red-600">{formatCurrency(forecastFullYearCosts)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-100 rounded-lg border-2 border-blue-300">
                  <span className="text-blue-900 font-bold text-sm">Resultaat</span>
                  <span className={`font-bold ${(forecastFullYearIncome - forecastFullYearCosts) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatCurrency(forecastFullYearIncome - forecastFullYearCosts)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-300 text-center mt-2">
                  Werkelijk + Gepland restant
                </div>
              </div>
            </Card>

            {/* BUDGET VOLLEDIG JAAR */}
            <Card className="p-6 bg-gradient-to-br from-primary-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 border-2 border-primary-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-4 h-4 bg-primary-500 rounded-full"></div>
                <h3 className="text-lg font-bold text-primary-900">📈 Budget {currentYear}</h3>
                <span className="text-xs bg-primary-200 text-primary-800 px-2 py-1 rounded">
                  Planning
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Inkomsten</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(projectedFullYearIncome)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">Kosten</span>
                  <span className="font-bold text-red-600">{formatCurrency(projectedFullYearCosts)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-primary-100 rounded-lg border-2 border-primary-300">
                  <span className="text-primary-900 font-bold text-sm">Resultaat</span>
                  <span className={`font-bold ${(projectedFullYearIncome - projectedFullYearCosts) >= 0 ? 'text-primary-700' : 'text-red-700'}`}>
                    {formatCurrency(projectedFullYearIncome - projectedFullYearCosts)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-300 text-center mt-2">
                  Budget items gewogen
                </div>
              </div>
            </Card>
          </div>

          {/* Variantie analyse */}
          {yearProgress > 0.1 && (
            <Card className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-gray-800 dark:to-gray-800 border-l-4 border-l-orange-500">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">📊 Analyse vs Budget</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-300 mb-1">Inkomsten YTD</p>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${incomeVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {incomeVariance >= 0 ? '+' : ''}{formatCurrency(incomeVariance)}
                    </span>
                    <span className={`text-xs ${incomeVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ({((incomeVariance / projectedYTDIncome) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-300 mb-1">Kosten YTD</p>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${costVariance <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {costVariance >= 0 ? '+' : ''}{formatCurrency(costVariance)}
                    </span>
                    <span className={`text-xs ${costVariance <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ({((costVariance / projectedYTDCosts) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-3 text-center">
                Vergelijking van werkelijke cijfers met budget verwachting tot nu toe
              </p>
            </Card>
          )}

          {/* REALITY PROJECTIONS - Compacter */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-emerald-900">📊 Realiteit - Meerjarenprojectie</h3>
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-emerald-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-emerald-700 uppercase">Jaar</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-700 uppercase">Inkomsten</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-red-700 uppercase">Kosten</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-primary-700 uppercase">Resultaat</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Marge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {generateRealityProjections().map((proj, idx) => (
                      <tr key={proj.year} className={idx === 0 ? 'bg-emerald-50' : ''}>
                        <td className="px-4 py-4">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{proj.year}</span>
                          {idx === 0 && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded">
                              Actueel
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-medium text-emerald-600">{formatCurrency(proj.income)}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-medium text-red-600">{formatCurrency(proj.costs)}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className={`font-bold ${proj.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {proj.profit >= 0 ? '+' : ''}{formatCurrency(proj.profit)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className={`font-medium ${proj.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {proj.income > 0 ? ((proj.profit / proj.income) * 100).toFixed(1) : 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">Gebaseerd op werkelijke uitgaande facturen (inkomsten) en inkomende facturen (kosten)</p>
          </div>

          {/* BUDGET PROJECTIONS - Compacter */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-primary-900">📈 Prognose - Meerjarenprojectie</h3>
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-primary-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-primary-700 uppercase">Jaar</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-emerald-700 uppercase">Inkomsten</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-red-700 uppercase">Kosten</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-primary-700 uppercase">Resultaat</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Marge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {generateBudgetProjections().map((proj, idx) => (
                      <tr key={proj.year} className={idx === 0 ? 'bg-primary-50' : ''}>
                        <td className="px-4 py-4">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{proj.year}</span>
                          {idx === 0 && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded">
                              Huidig
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-medium text-emerald-600">{formatCurrency(proj.income)}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-medium text-red-600">{formatCurrency(proj.costs)}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className={`font-bold ${proj.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {proj.profit >= 0 ? '+' : ''}{formatCurrency(proj.profit)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className={`font-medium ${proj.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {proj.income > 0 ? ((proj.profit / proj.income) * 100).toFixed(1) : 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">Gebaseerd op budget items met gewogen zekerheid en groeipercentages</p>
          </div>
        </div>
      )}

      {/* Investment Pitch Tab */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={handleCloseModal} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                {editingItem ? 'Item Bewerken' : `Nieuw ${formData.type === 'income' ? 'Inkomst' : 'Kost'}`}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type Toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'cost', category: 'software' })}
                      className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${ formData.type === 'cost' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 dark:text-gray-500' }`}
                    >
                      <TrendingDown className="h-4 w-4" />
                      Kost
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'income', category: 'services' })}
                      className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${ formData.type === 'income' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 dark:text-gray-500' }`}
                    >
                      <TrendingUp className="h-4 w-4" />
                      Inkomst
                    </button>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Naam *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder={formData.type === 'income' ? 'bijv. Enterprise Klant A' : 'bijv. Microsoft 365'}
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Categorie</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(formData.type === 'cost'
                      ? Object.keys(COST_CATEGORY_CONFIG) as BudgetCostCategory[]
                      : Object.keys(INCOME_CATEGORY_CONFIG) as BudgetIncomeCategory[]
                    ).map((cat) => {
                      const config = formData.type === 'cost'
                        ? COST_CATEGORY_CONFIG[cat as BudgetCostCategory]
                        : INCOME_CATEGORY_CONFIG[cat as BudgetIncomeCategory];
                      const Icon = config.icon;
                      const isSelected = formData.category === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormData({ ...formData, category: cat })}
                          className={`p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                            isSelected
                              ? `${config.borderColor} ${config.bgColor}`
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${isSelected ? config.textColor : 'text-gray-400 dark:text-gray-500'}`} />
                          <span className={`text-xs truncate w-full text-center ${isSelected ? config.textColor : 'text-gray-500 dark:text-gray-300 dark:text-gray-500'}`}>
                            {config.label.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Amount & Frequency */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Bedrag *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-300">€</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Frequentie</label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value as BudgetFrequency })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="monthly">Maandelijks</option>
                      <option value="quarterly">Per kwartaal</option>
                      <option value="yearly">Jaarlijks</option>
                    </select>
                  </div>
                </div>

                {/* Income-specific: Confidence & Growth */}
                {formData.type === 'income' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Zekerheid</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(Object.keys(CONFIDENCE_CONFIG) as ProjectionConfidence[]).map((conf) => {
                          const config = CONFIDENCE_CONFIG[conf];
                          const Icon = config.icon;
                          const isSelected = formData.confidence === conf;
                          return (
                            <button
                              key={conf}
                              type="button"
                              onClick={() => setFormData({ ...formData, confidence: conf })}
                              className={`p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                                isSelected
                                  ? `border-gray-800 ${config.bgColor}`
                                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              <Icon className={`h-4 w-4 ${isSelected ? config.color : 'text-gray-400 dark:text-gray-500'}`} />
                              <span className={`text-xs ${isSelected ? config.color : 'text-gray-500 dark:text-gray-300 dark:text-gray-500'}`}>
                                {config.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Verwachte Groei per Jaar (%)
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={formData.growthRate}
                        onChange={(e) => setFormData({ ...formData, growthRate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                        placeholder="0"
                      />
                    </div>
                  </>
                )}

                {/* Supplier/Client */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    {formData.type === 'income' ? 'Klant' : 'Leverancier'}
                  </label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder={formData.type === 'income' ? 'bijv. ACME Corp' : 'bijv. Microsoft'}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Notities</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="Eventuele opmerkingen..."
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Actief (meerekenen in totalen)
                  </label>
                </div>

                {/* Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button type="button" variant="secondary" onClick={handleCloseModal}>
                    Annuleren
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Opslaan...' : editingItem ? 'Bijwerken' : 'Toevoegen'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Pitch Deck Modal */}
      {isPitchDeckOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="flex min-h-full items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsPitchDeckOpen(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full h-full md:w-[95vw] md:h-[95vh] md:max-w-7xl overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gray-50 dark:bg-gray-900">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Investment Pitch Deck</h2>
                <button
                  onClick={() => setIsPitchDeckOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Sluiten"
                >
                  <svg className="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Iframe Content */}
              <div className="flex-1 overflow-hidden">
                <iframe
                  src="/investment-pitch?mode=frame"
                  className="w-full h-full border-0"
                  title="Investment Pitch Deck"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Budgeting;