// src/utils/menuConfig.ts
// Navigation configuration — Single Source of Truth voor alle menu's

import {
  LayoutDashboard,
  Building2,
  Users,
  Clock,
  CalendarCheck,
  Stethoscope,
  FileText,
  Settings,
  Shield,
  Receipt,
  Send,
  TrendingUp,
  Factory,
  BarChart2,
  Wallet,
  UserPlus,
  LineChart,
  PieChart,
  ListChecks,
  Mail,
  FileInput,
  ClipboardList,
  CreditCard,
  Handshake,
  Upload,
  HeartPulse,
  Calendar,
  User,
  Cpu,
  Download,
  Home,
  Zap,
  CheckCircle2,
  Package,
  ListTodo,
  MoreVertical,
  FolderKanban,
  BookOpen,
  MessageSquare,
  Car,
} from 'lucide-react';

export type CompanyType = 'employer' | 'project' | 'holding' | 'shareholder' | 'investor';

export interface NavigationItem {
  id: string;
  name: string;
  nameByRole?: Partial<Record<string, string>>;
  href: string;
  hrefByRole?: Partial<Record<string, string>>;
  icon: React.ComponentType<{ className?: string }>;
  /** Emoji-icon shown in sidebar / mobile menu — matches design preview */
  emoji: string;
  roles: string[];
  companyTypes: CompanyType[];
  badge?: string;
  color?: string;
  section?: string;
}

// Helper: toon de juiste naam per rol
export const getItemDisplayName = (item: NavigationItem, role: string | null): string =>
  (role && item.nameByRole?.[role]) || item.name;

// Helper: geef het juiste href terug per rol (boekhouder krijgt /boekhouder/* paden)
export const getItemHref = (item: NavigationItem, role: string | null): string =>
  (role && item.hrefByRole?.[role]) || item.href;

// ─── ALLE MENU ITEMS ────────────────────────────────────────────────────────

export const ALL_NAVIGATION_ITEMS: NavigationItem[] = [
  // DASHBOARD
  { id: 'dashboard', name: 'Dashboard', emoji: '📊', hrefByRole: { boekhouder: '/boekhouder' }, href: '/', icon: LayoutDashboard, roles: ['admin', 'co-admin', 'manager', 'employee', 'boekhouder'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },

  // HR / PERSONEEL (employer)
  { id: 'employees', name: 'Werknemers', emoji: '👥', nameByRole: { manager: 'Mijn Team' }, href: '/employees', icon: Users, roles: ['admin', 'co-admin', 'manager'], companyTypes: ['employer'] },
  { id: 'timesheet-approvals', name: 'Uren Goedkeuren', emoji: '✅', href: '/timesheet-approvals', icon: ClipboardList, roles: ['admin', 'co-admin', 'manager'], companyTypes: ['employer'] },
  { id: 'internal-projects', name: 'Interne Projecten', emoji: '🛠️', href: '/internal-projects', icon: FolderKanban, roles: ['admin', 'co-admin'], companyTypes: ['employer'] },
  { id: 'auto-beheer', name: 'Auto Beheer', emoji: '🚗', href: '/auto-beheer', icon: Car, roles: ['admin', 'co-admin', 'manager'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'payroll-processing', name: 'Loonverwerking', emoji: '💰', href: '/payslips', icon: CreditCard, roles: ['admin', 'co-admin', 'manager'], companyTypes: ['employer'] },
  { id: 'leave-approvals', name: 'Verlof Beheren', emoji: '🌴', nameByRole: { manager: 'Verlof Goedkeuren' }, href: '/admin/leave-approvals', icon: CalendarCheck, roles: ['admin', 'co-admin', 'manager'], companyTypes: ['employer'] },
  { id: 'absence-management', name: 'Verzuim Beheren', emoji: '🏥', href: '/admin/absence-management', icon: Stethoscope, roles: ['admin', 'co-admin', 'manager'], companyTypes: ['employer'] },

  // FINANCIEEL (alle bedrijfstypes) — boekhouder krijgt /boekhouder/* paden via hrefByRole
  { id: 'invoice-relations', name: 'Klanten & Leveranciers', emoji: '🤝', href: '/invoice-relations', hrefByRole: { boekhouder: '/boekhouder/invoice-relations' }, icon: Handshake, roles: ['admin', 'co-admin', 'boekhouder'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'budgeting', name: 'Begroting', emoji: '💼', href: '/budgeting', icon: Wallet, roles: ['admin', 'co-admin'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'admin-expenses', name: 'Declaraties', emoji: '🧾', href: '/admin-expenses', hrefByRole: { boekhouder: '/boekhouder/admin-expenses' }, icon: Receipt, roles: ['admin', 'co-admin', 'boekhouder'], companyTypes: ['employer'] },
  { id: 'outgoing-invoices', name: 'Verkoop', emoji: '📤', href: '/outgoing-invoices', hrefByRole: { boekhouder: '/boekhouder/outgoing-invoices' }, icon: Send, roles: ['admin', 'co-admin', 'boekhouder'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'incoming-invoices-stats', name: 'Inkoop', emoji: '📥', href: '/incoming-invoices-stats', hrefByRole: { boekhouder: '/boekhouder/incoming-invoices-stats' }, icon: PieChart, roles: ['admin', 'co-admin', 'boekhouder'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'bank-statement-import', name: 'Bankafschrift Import', emoji: '🏦', href: '/bank-statement-import', hrefByRole: { boekhouder: '/boekhouder/bank-statement-import' }, icon: FileInput, roles: ['admin', 'co-admin', 'boekhouder'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'grootboekrekeningen', name: 'Rekeningschema', emoji: '📒', href: '/grootboekrekeningen', hrefByRole: { boekhouder: '/boekhouder/grootboekrekeningen' }, icon: BookOpen, roles: ['admin', 'co-admin', 'boekhouder'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'btw-overzicht', name: 'BTW Overzicht', emoji: '🧮', href: '/btw-overzicht', hrefByRole: { boekhouder: '/boekhouder/btw-overzicht' }, icon: Receipt, roles: ['admin', 'co-admin', 'boekhouder'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },

  // PROJECT (project bedrijven)
  { id: 'project-production', name: 'Productie', emoji: '🏭', href: '/project-production', icon: Factory, roles: ['admin', 'co-admin', 'manager'], companyTypes: ['project'] },
  { id: 'project-statistics', name: 'Project Overzicht', emoji: '📊', href: '/project-statistics', icon: BarChart2, roles: ['admin', 'co-admin'], companyTypes: ['project'] },
  { id: 'project-team', name: 'Project Team', emoji: '👷', href: '/project-team', icon: Users, roles: ['admin', 'co-admin'], companyTypes: ['project'] },

  // STATISTIEKEN (alle bedrijfstypes)
  { id: 'statistics-employer', name: 'Werkgever Stats', emoji: '📈', href: '/statistics/employer', icon: TrendingUp, roles: ['admin', 'co-admin', 'manager'], companyTypes: ['employer'] },
  { id: 'statistics-project', name: 'Project Stats', emoji: '📊', href: '/statistics/project', icon: TrendingUp, roles: ['admin', 'co-admin', 'manager'], companyTypes: ['project'] },
  { id: 'statistics-holding', name: 'Holding Stats', emoji: '🏛️', href: '/statistics/holding', icon: TrendingUp, roles: ['admin', 'co-admin', 'manager'], companyTypes: ['holding', 'shareholder'] },

  // MIJN ZAKEN (manager + employee self-service)
  { id: 'timesheets', name: 'Urenregistratie', emoji: '⏱️', nameByRole: { employee: 'Mijn Uren', manager: 'Mijn Uren' }, href: '/timesheets', icon: Clock, roles: ['employee', 'manager'], companyTypes: ['employer', 'project'] },
  { id: 'leave', name: 'Verlof', emoji: '🌴', nameByRole: { employee: 'Mijn Verlof' }, href: '/leave', icon: CalendarCheck, roles: ['employee', 'manager'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'absence', name: 'Ziekteverzuim', emoji: '🏥', href: '/absence', icon: HeartPulse, roles: ['employee', 'manager'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'expenses-employee', name: 'Declaraties Medewerkers', emoji: '🧾', nameByRole: { employee: 'Mijn Declaraties' }, href: '/expenses', icon: Receipt, roles: ['employee', 'manager'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'payslips', name: 'Loonstroken', emoji: '💵', nameByRole: { employee: 'Mijn Loonstroken' }, href: '/payslips', icon: FileText, roles: ['employee', 'manager'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'vehicle-self', name: 'Mijn Auto', emoji: '🚗', href: '/vehicle', icon: Car, roles: ['manager'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },

  // COMMUNICATIE
  { id: 'chat', name: 'Berichten', emoji: '💬', href: '/chat', hrefByRole: { boekhouder: '/boekhouder/chat' }, icon: MessageSquare, roles: ['admin', 'co-admin', 'boekhouder'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },

  // LOONSTROKEN UPLOAD (alleen boekhouder, alleen op loonmaatschappij)
  { id: 'payslip-upload', name: 'Loonstroken uploaden', emoji: '📤', href: '/boekhouder/payslip-upload', icon: FileText, roles: ['boekhouder'], companyTypes: ['employer'] },

  // SYSTEEM
  { id: 'upload', name: 'Upload', emoji: '📎', href: '/upload', hrefByRole: { boekhouder: '/boekhouder/upload' }, icon: Upload, roles: ['admin', 'co-admin', 'boekhouder'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'tasks', name: 'Taken', emoji: '☑️', href: '/tasks', hrefByRole: { boekhouder: '/boekhouder/tasks' }, icon: ListChecks, roles: ['admin', 'co-admin', 'manager', 'boekhouder'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
  { id: 'companies', name: 'Bedrijven', emoji: '🏢', href: '/companies', icon: Building2, roles: ['admin', 'co-admin'], companyTypes: ['employer', 'holding', 'shareholder'] },
  { id: 'audit-log', name: 'Audit Log', emoji: '📜', href: '/audit-log', icon: Shield, roles: ['admin', 'co-admin'], companyTypes: ['employer', 'holding', 'shareholder'] },
  { id: 'users', name: 'Gebruikers Beheer', emoji: '👤', href: '/admin/users', icon: UserPlus, roles: ['admin'], companyTypes: ['employer', 'holding', 'shareholder'] },
  { id: 'investment-pitch', name: 'Investment Pitch', emoji: '🚀', href: '/investment-pitch', icon: LineChart, roles: ['admin', 'co-admin'], companyTypes: ['project', 'holding'] },
  { id: 'settings', name: 'Instellingen', emoji: '⚙️', href: '/settings', hrefByRole: { boekhouder: '/boekhouder/settings' }, icon: Settings, roles: ['admin', 'co-admin', 'employee', 'manager', 'boekhouder'], companyTypes: ['employer', 'project', 'holding', 'shareholder'] },
];

// ─── SECTION DEFINITIONS ────────────────────────────────────────────────────

export interface Section {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavigationItem[];
  defaultOpen?: boolean;
  color: string;
}

// Items per sectie (via id)
const SECTION_ITEMS: Record<string, string[]> = {
  Statistieken: ['statistics-employer', 'statistics-project', 'statistics-holding'],
  HR: ['employees', 'timesheet-approvals', 'internal-projects', 'auto-beheer', 'payroll-processing', 'leave-approvals', 'absence-management'],
  Financieel: ['invoice-relations', 'budgeting', 'admin-expenses', 'outgoing-invoices', 'incoming-invoices-stats', 'bank-statement-import', 'grootboekrekeningen', 'btw-overzicht'],
  Project: ['project-production', 'project-statistics', 'project-team'],
  'Mijn Zaken': ['timesheets', 'leave', 'absence', 'expenses-employee', 'payslips', 'vehicle-self'],
  Systeem: ['chat', 'payslip-upload', 'upload', 'tasks', 'companies', 'audit-log', 'users', 'investment-pitch', 'settings'],
};

const SECTION_META: Array<{ title: string; icon: React.ComponentType<{ className?: string }>; color: string; defaultOpen?: boolean }> = [
  { title: 'Statistieken', icon: TrendingUp, color: 'bg-indigo-500', defaultOpen: false },
  { title: 'HR', icon: Users, color: 'bg-blue-500', defaultOpen: false },
  { title: 'Financieel', icon: Wallet, color: 'bg-emerald-500', defaultOpen: false },
  { title: 'Project', icon: Factory, color: 'bg-orange-500', defaultOpen: false },
  { title: 'Mijn Zaken', icon: User, color: 'bg-cyan-500', defaultOpen: false },
  { title: 'Systeem', icon: Settings, color: 'bg-gray-500', defaultOpen: false },
];

// ─── FILTER & SECTION FUNCTIONS ─────────────────────────────────────────────

/**
 * Get filtered navigation items based on user role and company type
 */
export const getFilteredNavigation = (
  userRole: string | null,
  companyType?: CompanyType
): NavigationItem[] => {
  if (!userRole || !companyType) return [];

  return ALL_NAVIGATION_ITEMS
    .filter(item => item.roles.includes(userRole) && item.companyTypes.includes(companyType))
    .map(item => {
      // Rewrite href per rol (boekhouder → /boekhouder/*)
      const hrefForRole = item.hrefByRole?.[userRole];
      return hrefForRole ? { ...item, href: hrefForRole } : item;
    });
};

/**
 * Get navigation sections based on user role and company type
 * Uniforme sectie-indeling voor Sidebar en MobileFullScreenMenu
 */
export const getNavigationSections = (
  userRole: string | null,
  companyType?: CompanyType
): Section[] => {
  const filtered = getFilteredNavigation(userRole, companyType);

  return SECTION_META.map(meta => ({
    ...meta,
    items: filtered.filter(item => SECTION_ITEMS[meta.title]?.includes(item.id)),
  })).filter(section => section.items.length > 0);
};

// ─── BOTTOM NAV DEFAULTS ────────────────────────────────────────────────────

export interface BottomNavDefault {
  href: string;
  icon: string;
  iconComponent: React.ComponentType<{ className?: string }>;
  emoji: string;
  label: string;
  gradient: string;
}

// Gedeelde icon map voor string → component mapping (Firestore slaat strings op)
export const ICON_MAP: Record<string, React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>> = {
  Home,
  Clock,
  Settings,
  Users,
  Zap,
  CheckCircle2,
  Cpu,
  Package,
  Send,
  Download,
  Upload,
  Wallet,
  TrendingUp,
  ListTodo,
  PieChart,
  BookOpen,
  FileInput,
  Handshake,
  Receipt,
  MessageSquare,
};

/**
 * Get the 3 default middle items for mobile bottom nav
 * Eén bron voor zowel MobileBottomNav als BottomNavSettings
 */
export const getBottomNavDefaults = (
  userRole: string | null,
  companyType?: CompanyType
): BottomNavDefault[] => {
  if (!userRole || !companyType) return [];

  // HOLDING
  if (companyType === 'holding') {
    return [
      { href: '/statistics/holding', icon: 'TrendingUp', iconComponent: TrendingUp, emoji: '📈', label: 'Stats', gradient: 'from-primary-600 to-primary-700' },
      { href: '/outgoing-invoices', icon: 'Send', iconComponent: Send, emoji: '📤', label: 'Verkoop', gradient: 'from-primary-500 to-primary-600' },
      { href: '/budgeting', icon: 'Wallet', iconComponent: Wallet, emoji: '💼', label: 'Begroting', gradient: 'from-primary-600 to-primary-700' },
    ];
  }

  // SHAREHOLDER
  if (companyType === 'shareholder') {
    return [
      { href: '/statistics/holding', icon: 'TrendingUp', iconComponent: TrendingUp, emoji: '📈', label: 'Stats', gradient: 'from-primary-600 to-primary-700' },
      { href: '/outgoing-invoices', icon: 'Send', iconComponent: Send, emoji: '📤', label: 'Facturen', gradient: 'from-primary-500 to-primary-600' },
      { href: '/incoming-invoices', icon: 'Upload', iconComponent: Upload, emoji: '📎', label: 'Inkoop', gradient: 'from-primary-600 to-primary-700' },
    ];
  }

  // PROJECT
  if (companyType === 'project') {
    return [
      { href: '/statistics/project', icon: 'TrendingUp', iconComponent: TrendingUp, emoji: '📈', label: 'Stats', gradient: 'from-primary-600 to-primary-700' },
      { href: '/project-production', icon: 'Cpu', iconComponent: Cpu, emoji: '🏭', label: 'Productie', gradient: 'from-primary-500 to-primary-600' },
      { href: '/outgoing-invoices', icon: 'Send', iconComponent: Send, emoji: '📤', label: 'Facturen', gradient: 'from-primary-600 to-primary-700' },
    ];
  }

  // EMPLOYER - per rol
  if (userRole === 'admin' || userRole === 'co-admin') {
    return [
      { href: '/outgoing-invoices', icon: 'Send', iconComponent: Send, emoji: '📤', label: 'Verkoop', gradient: 'from-primary-600 to-primary-700' },
      { href: '/timesheet-approvals', icon: 'CheckCircle2', iconComponent: CheckCircle2, emoji: '✅', label: 'Uren', gradient: 'from-primary-500 to-primary-600' },
      { href: '/upload', icon: 'Upload', iconComponent: Upload, emoji: '📎', label: 'Upload', gradient: 'from-primary-600 to-primary-700' },
    ];
  }

  if (userRole === 'manager') {
    return [
      { href: '/statistics/employer', icon: 'TrendingUp', iconComponent: TrendingUp, emoji: '📈', label: 'Stats', gradient: 'from-primary-600 to-primary-700' },
      { href: '/employees', icon: 'Users', iconComponent: Users, emoji: '👥', label: 'Team', gradient: 'from-primary-500 to-primary-600' },
      { href: '/timesheet-approvals', icon: 'CheckCircle2', iconComponent: CheckCircle2, emoji: '✅', label: 'Beheren', gradient: 'from-primary-600 to-primary-700' },
    ];
  }

  if (userRole === 'boekhouder') {
    return [
      { href: '/boekhouder/upload', icon: 'Upload', iconComponent: Upload, emoji: '📎', label: 'Upload', gradient: 'from-primary-600 to-primary-700' },
      { href: '/boekhouder/btw-overzicht', icon: 'Wallet', iconComponent: Wallet, emoji: '🧮', label: 'BTW', gradient: 'from-primary-500 to-primary-600' },
      { href: '/boekhouder/grootboekrekeningen', icon: 'BookOpen', iconComponent: BookOpen, emoji: '📒', label: 'Grootboek', gradient: 'from-primary-600 to-primary-700' },
    ];
  }

  // Employee
  return [
    { href: '/timesheets', icon: 'Clock', iconComponent: Clock, emoji: '⏱️', label: 'Uren', gradient: 'from-primary-600 to-primary-700' },
    { href: '/payslips', icon: 'CheckCircle2', iconComponent: CheckCircle2, emoji: '💵', label: 'Loonstrook', gradient: 'from-primary-500 to-primary-600' },
    { href: '/settings', icon: 'Settings', iconComponent: Settings, emoji: '⚙️', label: 'Profiel', gradient: 'from-primary-600 to-primary-700' },
  ];
};

// ─── MENU ITEM HELPERS ──────────────────────────────────────────────────────

/**
 * Check if menu item should be disabled (company not selected)
 */
export const isMenuItemDisabled = (
  item: NavigationItem,
  selectedCompanyId?: string
): boolean => {
  const noCompanyRequired = ['dashboard', 'companies', 'settings'];
  if (noCompanyRequired.includes(item.id)) return false;
  return !selectedCompanyId;
};

/**
 * Get tooltip for disabled menu items
 */
export const getMenuItemDisabledReason = (item: NavigationItem): string => {
  const noCompanyRequired = ['dashboard', 'companies', 'settings'];
  if (!noCompanyRequired.includes(item.id)) return 'Selecteer eerst een bedrijf';
  return '';
};
