export interface Company {
  id: string;
  userId: string;
  name: string;
  kvk: string;
  taxNumber: string;

  // ✅ AANGEPAST: Bedrijfstype structuur
  companyType: 'employer' | 'project' | 'holding' | 'shareholder' | 'investor';
  // 'employer' = Loonmaatschappij (Buddy) waar personeel in dienst is
  // 'project' = Werkmaatschappij waar personeel wordt gedetacheerd
  // 'holding' = Operationele holding (Festina Lente) die garant staat
  // 'shareholder' = Aandeelhouder (Sandebeheer, Carlibeheer) met participaties
  // 'investor' = Project investeerder (toekomstig)

  payrollCompanyId?: string; // Voor work companies - verwijst naar loonmaatschappij
  primaryEmployerId?: string; // Voor project/holding companies - verwijst naar hoofdbedrijf
  shareholdings?: Array<{ companyId: string; percentage: number }>; // Voor shareholders - participaties in andere bedrijven
  hourlyRate?: number; // Uurtarief excl. BTW voor project bedrijven (werkmaatschappijen)

  // ✅ NIEUW: Toegangsbeheer - managers/gebruikers die toegang hebben tot dit bedrijf
  allowedUsers?: string[]; // Array van user UIDs die toegang hebben tot dit bedrijf

  address: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
  contactInfo: {
    email: string;
    phone: string;
    website?: string;
  };
  settings: {
    defaultCAO: string;
    travelAllowancePerKm: number;
    standardWorkWeek: number;
    holidayAllowancePercentage: number;
    pensionContributionPercentage: number;
  };
  logoUrl?: string;
  themeColor?: string; // Primary color for this company (e.g., 'blue', 'green', 'purple')
  createdAt: Date;
  updatedAt: Date;
  mainBranchId?: string;
}

export interface Branch {
  id: string;
  userId: string;
  companyId: string;
  name: string;
  location: string;
  costCenter: string;
  cao?: string;
  specificSettings?: {
    overtimeRate: number;
    irregularRate: number;
    shiftRate: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Employee {
  id: string;
  userId: string;
  companyId: string; // Refers to the employer company (payroll company)
  branchId: string;

  // Project/work companies where employee works
  projectCompanies?: string[]; // Array of project company IDs
  
  personalInfo: {
    firstName: string;
    lastName: string;
    initials: string;
    bsn: string;
    dateOfBirth: Date;
    placeOfBirth: string;
    nationality: string;
    
    address: {
      street: string;
      houseNumber: string;
      houseNumberAddition?: string;
      postalCode: string;
      city: string;
      country: string;
    };
    
    contactInfo: {
      email: string;
      phone: string;
      emergencyContact?: {
        name: string;
        phone: string;
        relation: string;
      };
    };
    
    bankAccount: string;
    maritalStatus: 'single' | 'married' | 'registered_partnership' | 'divorced' | 'widowed';
    identityDocument?: string;
  };
  
  contractInfo: {
    type: 'permanent' | 'temporary' | 'zero_hours' | 'on_call' | 'intern' | 'dga' | 'payroll' | 'freelance';
    startDate: Date;
    endDate?: Date;
    probationPeriod?: number;
    hoursPerWeek: number;
    position: string;
    department?: string;
    costCenter?: string;
    
    cao: string;
    caoCode?: string;
    
    contractStatus: 'active' | 'notice_period' | 'ended' | 'suspended';
    noticeDate?: Date;
    endReason?: string;
  };
  
  salaryInfo: {
    salaryScale: string;
    
    hourlyRate?: number;
    monthlySalary?: number;
    annualSalary?: number;
    
    paymentType: 'hourly' | 'monthly' | 'annual';
    paymentFrequency: 'monthly' | 'four_weekly' | 'weekly';
    
    allowances: {
      overtime: number;
      irregular: number;
      shift: number;
      evening: number;
      night: number;
      weekend: number;
      sunday: number;
    };
    
    travelAllowancePerKm: number;
    phoneAllowance?: number;
    internetAllowance?: number;
    
    taxTable: 'white' | 'green';
    taxCredit: boolean;
    socialSecurityNumber?: string;
  };
  
  leaveInfo: {
    vacation: {
      entitlement: number;
      accrued: number;
      taken: number;
      remaining: number;
    };
    
    adv?: {
      accumulated: number;
      taken: number;
      remaining: number;
    };
    
    seniorDays?: number;
    snipperDays?: number;
  };
  
  status: 'active' | 'inactive' | 'on_leave' | 'sick';
  
  hasAccount: boolean;
  accountCreatedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
  
  salaryHistory?: {
    date: Date;
    oldValue: number;
    newValue: number;
    reason: string;
    changedBy: string;
  }[];
}

export interface TimeEntry {
  id: string;
  userId: string;
  employeeId: string;
  
  // ✅ AANGEPAST: Voor welke werkmaatschappij wordt gewerkt
  workCompanyId?: string; // Voor welk werkbedrijf wordt dit uur geregistreerd
  
  date: Date;
  regularHours: number;
  overtimeHours: number;
  irregularHours: number;
  travelKilometers: number;
  project?: string;
  branchId: string;
  notes?: string;
  
  // ✅ ENHANCED: Work activities voor detailed tracking
  workActivities?: {
    hours: number;
    description: string;
    clientId?: string;
    projectCode?: string;
    isITKnechtImport?: boolean;
  }[];
  
  status: 'draft' | 'approved' | 'processed';
  createdAt: Date;
  updatedAt: Date;
}

// ✅ AANGEPAST: Buddy Ecosystem management met loonmaatschappij/werkmaatschappij
export interface BuddyEcosystem {
  id: string;
  userId: string;
  name: string; // "Buddy Ecosystem"
  description?: string;
  
  payrollCompany: Company; // ✅ Buddy BV (loonmaatschappij)
  workCompanies: Company[]; // ✅ Alle werkmaatschappijen
  
  settings: {
    autoAssignToBuddy: boolean;
    allowCrossCompanyTimeTracking: boolean;
    centralizedPayroll: boolean;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeCompanyAssignment {
  id: string;
  employeeId: string;
  companyId: string;
  assignmentType: 'payroll' | 'work'; // ✅ AANGEPAST: payroll vs work
  assignedBy: string;
  assignedAt: Date;
  
  permissions: {
    canLogHours: boolean;
    canAccessReports: boolean;
    canViewPayslips: boolean;
  };
  
  settings: {
    defaultHourType: 'regular' | 'project';
    autoSelectCompany: boolean;
  };
}

export interface WorkContext {
  employee: Employee;
  payrollCompany: Company; // ✅ AANGEPAST: Loonmaatschappij (Buddy)
  availableWorkCompanies: Company[]; // ✅ AANGEPAST: Beschikbare werkmaatschappijen
  currentWorkCompany?: Company;
  
  capabilities: {
    canSwitchCompanies: boolean;
    requiresCompanySelection: boolean;
    hasMultipleAssignments: boolean;
  };
  
  defaultBehavior: {
    autoSelectPayroll: boolean; // ✅ AANGEPAST
    showCompanySelector: boolean;
    enableQuickSwitch: boolean;
  };
}

// ✅ ENHANCED: Smart timesheet interfaces
export interface SmartTimesheetEntry extends TimeEntry {
  detectedCompany?: Company;
  suggestedCompany?: Company;
  companyDetectionSource: 'manual' | 'auto' | 'import' | 'ai';
  
  validation: {
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  };
}

export interface TimesheetCompanyContext {
  employee: Employee;
  week: number;
  year: number;
  
  companySessions: {
    companyId: string;
    company: Company;
    totalHours: number;
    entries: TimeEntry[];
    isPayrollCompany: boolean; // ✅ AANGEPAST
  }[];
  
  summary: {
    totalHours: number;
    payrollCompanyHours: number; // ✅ AANGEPAST
    workCompanyHours: number; // ✅ AANGEPAST
    distributionPercentage: { [companyId: string]: number };
  };
}

// ✅ AANGEPAST: Company management met loonmaatschappij focus
export interface CompanyHierarchy {
  payrollCompany: Company; // ✅ Buddy BV
  workCompanies: Company[]; // ✅ Werkmaatschappijen
  employees: Employee[];
  
  statistics: {
    totalEmployees: number;
    activeWorkCompanies: number; // ✅ AANGEPAST
    monthlyHours: number;
    revenue: number;
  };
  
  relationships: {
    employeeWorkAssignments: { [employeeId: string]: string[] }; // ✅ AANGEPAST
    workCompanyHourDistribution: { [workCompanyId: string]: number }; // ✅ AANGEPAST
  };
}

// ✅ AANGEPAST: Helper interfaces
export interface PayrollCompanyWithEmployees extends Company {
  employees?: Employee[];
  workCompanies?: Company[]; // ✅ AANGEPAST
}

export interface EmployeeWithCompanies extends Employee {
  payrollCompanyData?: Company; // ✅ AANGEPAST
  workCompaniesData?: Company[]; // ✅ AANGEPAST
  workContext?: WorkContext;
}

export interface TimeEntryWithCompanyInfo extends TimeEntry {
  workCompany?: Company;
  payrollCompany?: Company; // ✅ AANGEPAST
  detectedProject?: string;
}

// ✅ AANGEPAST: Service interfaces voor business logic
export interface BuddyEcosystemManager {
  autoAssignEmployeeToBuddy(employee: Omit<Employee, 'id' | 'payrollCompanyId'>): Promise<Employee>;
  assignEmployeeToWorkCompanies(employeeId: string, workCompanyIds: string[]): Promise<void>; // ✅ AANGEPAST
  getEmployeeWorkContext(employeeId: string): Promise<WorkContext>;
  detectOptimalWorkCompany(timeEntry: Partial<TimeEntry>): Promise<Company | null>;
  validateCrossCompanyTimeEntry(timeEntry: TimeEntry): Promise<{ isValid: boolean; issues: string[] }>;
}

export interface SmartCompanySelector {
  shouldShowSelector(context: WorkContext): boolean;
  getDefaultCompany(context: WorkContext): Company;
  getAvailableCompanies(context: WorkContext): Company[];
  autoSelectCompany(context: WorkContext, timeEntry?: Partial<TimeEntry>): Company | null;
}

// ✅ AANGEPAST: Configuration interfaces
export interface EcosystemConfig {
  buddy: {
    autoAssignment: boolean;
    isDefaultPayrollCompany: boolean; // ✅ AANGEPAST
    allowDirectHourRegistration: boolean;
  };
  
  workCompanies: { // ✅ AANGEPAST
    requireExplicitAssignment: boolean;
    allowIndependentTimeTracking: boolean;
    inheritPayrollSettings: boolean;
  };
  
  timeTracking: {
    defaultToPayrollCompany: boolean; // ✅ AANGEPAST
    allowCrossCompanyHours: boolean;
    requireWorkCompanySelection: boolean; // ✅ AANGEPAST
  };
  
  payroll: {
    centralizedProcessing: boolean;
    allowWorkCompanySpecificRates: boolean; // ✅ AANGEPAST
    autoCalculateCrossCharges: boolean;
  };
}

// ✅ NIEUW: User Settings interface
export interface BottomNavItem {
  href: string;
  icon: string;  // Icon naam als string (bijv. 'Clock', 'Users', 'Send')
  label: string;
  gradient: string;
}

export interface UserSettings {
  id?: string;
  userId: string;
  defaultCompanyId?: string;  // Default bedrijf dat wordt geladen
  favoritePages?: { [companyId: string]: string[] };  // Favorieten per bedrijf
  bottomNavItems?: { [companyId: string]: BottomNavItem[] };  // Custom bottom nav iconen per bedrijf (3 items)
  // ✅ Co-admin mechanisme
  primaryAdminUserId?: string;
  primaryAdminEmail?: string;
  coAdminEmails?: string[];
  // ✅ Boekhouder mechanisme
  // Op admin user: lijst van boekhouder-emails die toegang hebben tot zijn bedrijven
  boekhouderEmails?: string[];
  // Op boekhouder user: UID's van admins die hem toegang gegeven hebben
  assignedAdminUserIds?: string[];
  visibleCompanyIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ✅ NIEUW: Budget/Begroting voor terugkerende kosten EN inkomsten
export type BudgetType = 'cost' | 'income';
export type BudgetCostCategory = 'telecom' | 'software' | 'vehicle' | 'insurance' | 'utilities' | 'subscriptions' | 'personnel' | 'marketing' | 'office' | 'other';
export type BudgetIncomeCategory = 'services' | 'products' | 'subscriptions' | 'consulting' | 'licensing' | 'partnerships' | 'grants' | 'other';
export type BudgetCategory = BudgetCostCategory | BudgetIncomeCategory;
export type BudgetFrequency = 'monthly' | 'quarterly' | 'yearly';

// Confidence level voor projecties (investeerder presentaties)
export type ProjectionConfidence = 'confirmed' | 'likely' | 'potential' | 'speculative';

export interface BudgetItem {
  id: string;
  userId: string;
  companyId: string;
  type: BudgetType;                // 'cost' of 'income'
  name: string;                    // "KPN Telefoon", "Microsoft 365", "SaaS Klant A", etc.
  category: BudgetCategory;
  amount: number;                  // Bedrag per periode
  frequency: BudgetFrequency;
  startDate: Date;
  endDate?: Date;                  // Optioneel, voor tijdelijke kosten/inkomsten
  supplier?: string;               // Leverancier (voor kosten) of Klant (voor inkomsten)
  contractNumber?: string;
  notes?: string;
  isActive: boolean;
  // Projectie velden voor investeerder presentaties
  confidence?: ProjectionConfidence;  // Zekerheid van de inkomst/kost
  growthRate?: number;             // Verwachte groei % per jaar
  createdAt: Date;
  updatedAt: Date;
}

// Alle overige interfaces blijven hetzelfde...
export interface AuditLog {
  id: string;
  userId: string;
  employeeId?: string;
  companyId?: string;
  action: string;
  description: string;
  entityType: 'employee' | 'company' | 'timesheet' | 'payroll' | 'expense' | 'leave' | 'contract';
  entityId: string;
  changes?: {
    before: any;
    after: any;
  };
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    location?: string;
  };
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  employeeId?: string;
  companyId?: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  category: 'payroll' | 'timesheet' | 'leave' | 'expense' | 'contract' | 'system' | 'compliance';
  isRead: boolean;
  readAt?: Date;
  actionRequired: boolean;
  actionUrl?: string;
  actionText?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  expiresAt?: Date;
  metadata?: {
    relatedEntityType?: string;
    relatedEntityId?: string;
    automatedAction?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceUpdate {
  id: string;
  title: string;
  description: string;
  category: 'tax' | 'minimum-wage' | 'pension' | 'cao' | 'other';
  effectiveDate: Date;
  endDate?: Date;
  sourceUrl: string;
  isNew: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardStats {
  activeEmployees: number;
  totalGrossThisMonth: number;
  companiesCount: number;
  branchesCount: number;
  pendingApprovals: number;
}

export interface CAO {
  id: string;
  name: string;
  code: string;
  sector: string;
  description: string;
  
  salaryScales: {
    scale: string;
    hourlyRates: { [key: string]: number };
    monthlyRates: { [key: string]: number };
  }[];
  
  allowances: {
    overtime: number;
    irregular: number;
    shift: number;
    weekend: number;
    evening?: number;
    night?: number;
    sunday?: number;
  };
  
  travelAllowancePerKm: number;
  holidayAllowancePercentage: number;
  
  holidayDaysFormula: string;
  extraDays?: number;
  
  pensionFund?: string;
  pensionAge: number;
  pensionContribution: {
    employee: number;
    employer: number;
  };
  
  specialProvisions?: string[];
  
  effectiveDate: Date;
  endDate?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  id: string;
  uid: string;
  role: 'admin' | 'co-admin' | 'manager' | 'boekhouder' | 'employee';
  employeeId?: string;
  assignedCompanyId?: string;
  /**
   * Voor boekhouder: lijst van admin UID's waarvan de boekhouder financiële data mag inzien.
   * Wordt onderhouden door iedere admin die de boekhouder toegang geeft via Settings.
   */
  assignedAdminUserIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  employeeId: string;
  companyId: string;
  type: 'holiday' | 'sick' | 'special' | 'unpaid' | 'parental' | 'care' | 'short_leave' | 'adv';
  startDate: Date;
  endDate: Date;
  totalDays: number;
  totalHours: number;
  partialDay?: {
    date: Date;
    startTime: string;
    endTime: string;
    hours: number;
  };
  reason?: string;
  notes?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string;
  approvedAt?: Date;
  rejectedReason?: string;
  sickLeaveDetails?: {
    reportedAt: Date;
    reportedBy: string;
    expectedReturn?: Date;
    actualReturn?: Date;
    doctorNote?: string;
    percentage: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveBalance {
  id?: string;
  employeeId: string;
  companyId: string;
  year: number;
  holidayDays: {
    statutory: number;
    extraStatutory: number;
    carried: number;
    accumulated: number;
    taken: number;
    pending: number;
    remaining: number;
    expires: Date;
  };
  advDays?: {
    entitled: number;
    accumulated: number;
    taken: number;
    remaining: number;
  };
  seniorDays: number;
  snipperDays: number;
  updatedAt: Date;
}

export type LeaveType = LeaveRequest['type'];
export type LeaveStatus = LeaveRequest['status'];

export interface SickLeave {
  id: string;
  userId: string;
  employeeId: string;
  companyId: string;
  startDate: Date;
  reportedAt: Date;
  reportedBy: string;
  reportedVia: 'phone' | 'email' | 'app' | 'in_person';
  endDate?: Date;
  actualReturnDate?: Date;
  status: 'active' | 'recovered' | 'partially_recovered' | 'long_term';
  workCapacityPercentage: number;
  reintegration?: {
    startDate: Date;
    plan: string;
    targetDate: Date;
    progress: string;
    meetingDates: Date[];
  };
  doctorVisits: {
    date: Date;
    doctor: string;
    notes?: string;
    certificate?: string;
  }[];
  arboServiceContacted: boolean;
  arboServiceDate?: Date;
  arboAdvice?: string;
  poortwachterActive: boolean;
  poortwachterMilestones?: {
    week: number;
    action: string;
    completedDate?: Date;
    status: 'pending' | 'completed' | 'overdue';
    dueDate: Date;
  }[];
  wiaApplication?: {
    appliedDate: Date;
    decision?: 'approved' | 'rejected' | 'pending';
    percentage?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AbsenceStatistics {
  totalAbsenceDays: number;
  totalAbsenceHours: number;
  absencePercentage: number;
  averageAbsenceDuration: number;
  sickLeaveFrequency: number;
  currentAbsences: number;
  longestAbsence: number;
  absencesByMonth: { [month: string]: number };
  absencesByType: { [type: string]: number };
  repeatAbsences: number;
}

export interface Expense {
  id: string;
  userId: string;
  employeeId: string;
  companyId: string;
  type: 'travel' | 'meal' | 'accommodation' | 'equipment' | 'training' | 'phone' | 'internet' | 'fuel' | 'parking' | 'public_transport' | 'other';
  description: string;
  amount: number;
  currency: string;
  date: Date;
  category: string;
  project?: string;
  client?: string;
  vehicle?: {
    type: VehicleType;
    licensePlate?: string;
    startLocation: string;
    endLocation: string;
    distance: number;
    hasReceipt: boolean;
  };
  receipt?: {
    filename: string;
    url: string;
    uploadedAt: Date;
  };
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
  submittedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: string;
  reimbursementDetails?: {
    method: 'bank_transfer' | 'cash' | 'payroll';
    reference: string;
    paidAt: Date;
    paidBy: string;
  };
  reviewHistory: {
    date: Date;
    action: 'submitted' | 'approved' | 'rejected' | 'paid';
    by: string;
    comment?: string;
  }[];
  paidInPayroll?: {
    payrollRunId: string;
    payrollDate: Date;
  };
  taxable: boolean;
  withinTaxFreeAllowance: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ExpenseType = Expense['type'];
export type ExpenseStatus = Expense['status'];
export type VehicleType = 'car' | 'bike' | 'public_transport' | 'taxi';

export type PayrollPeriodType = 'weekly' | 'bi-weekly' | 'monthly';
export type PayrollStatus = 'draft' | 'calculated' | 'approved' | 'paid' | 'finalized';

export interface PayrollPeriod {
  id?: string;
  userId: string;
  companyId: string;
  periodType: PayrollPeriodType;
  startDate: Date;
  endDate: Date;
  paymentDate: Date;
  status: PayrollStatus;
  employeeCount: number;
  totalGross: number;
  totalNet: number;
  totalTax: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollEarning {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  isTaxable: boolean;
}

export interface PayrollDeduction {
  description: string;
  amount: number;
  isPreTax: boolean;
}

export interface PayrollTaxes {
  incomeTax: number;
  socialSecurityEmployee: number;
  socialSecurityEmployer: number;
  healthInsurance: number;
  pensionEmployee: number;
  pensionEmployer: number;
  unemploymentInsurance: number;
  disabilityInsurance: number;
}

export interface HourlyRate {
  id?: string;
  userId: string;
  companyId: string;
  jobTitle: string;
  baseRate: number;
  overtimeMultiplier: number;
  eveningMultiplier: number;
  nightMultiplier: number;
  weekendMultiplier: number;
  holidayMultiplier: number;
  effectiveDate: Date;
  caoName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Allowance {
  id?: string;
  userId: string;
  companyId: string;
  name: string;
  type: 'shift' | 'irregular' | 'on-call' | 'travel' | 'other';
  amount: number;
  isPercentage: boolean;
  isTaxable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Deduction {
  id?: string;
  userId: string;
  employeeId: string;
  companyId: string;
  name: string;
  type: 'advance' | 'loan' | 'garnishment' | 'other';
  amount: number;
  isRecurring: boolean;
  startDate: Date;
  endDate?: Date;
  remainingAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxReturn {
  id: string;
  userId: string;
  companyId: string;
  period: {
    month: number;
    year: number;
  };
  status: 'draft' | 'submitted' | 'approved' | 'filed';
  data: any;
  submittedAt?: Date;
  filedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ✅ NIEUW: Business Task Management - Persoonsgebonden EN bedrijfsgebonden
export type TaskCategory = 'operational' | 'compliance' | 'financial' | 'hr' | 'sales' | 'contracts' | 'administration' | 'other';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
export type TaskFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface TaskChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: Date;
}

export interface BusinessTask {
  id: string;
  userId: string;  // Eigenaar van de taak (persoonsgebonden)
  companyId: string;  // Bedrijf waar taak bij hoort (bedrijfsgebonden)

  // Basis informatie
  title: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;

  // Toewijzing
  assignedTo?: string[];  // Employee IDs (Firestore) van toegewezen medewerkers
  estimatedHours?: number;  // Verwachte duur in uren (bepaald door admin)
  internalProjectId?: string;
  internalProjectName?: string;
  createdBy: string;  // User ID van maker

  // Datums
  dueDate: Date;
  startDate?: Date;
  completedDate?: Date;

  // Terugkerende taken
  isRecurring: boolean;
  frequency?: TaskFrequency;  // Frequentie van herhaling
  recurrenceDay?: number;  // Dag van de maand (1-31) of week (1-7)
  nextOccurrence?: Date;  // Wanneer is de volgende occurrence
  lastGenerated?: Date;  // Wanneer is de laatste occurrence gegenereerd

  // Voortgang
  status: TaskStatus;
  progress: number;  // 0-100

  // Gerelateerde entiteiten
  relatedEmployeeId?: string;
  relatedExpenseId?: string;
  relatedLeaveRequestId?: string;
  relatedInvoiceId?: string;

  // Checklist items (subtaken)
  checklist?: TaskChecklistItem[];

  // Scheduling door werknemer
  schedulingType?: 'fixed' | 'flexible'; // 'fixed' = manager plant op dueDate; 'flexible' = medewerker plant zelf in de week
  scheduledDate?: Date;         // Wanneer werknemer de taak heeft ingepland
  scheduledStartTime?: string;  // "09:00" format
  scheduledEndTime?: string;    // "10:30" format
  scheduledBy?: string;         // UID van wie het inplande
  scheduledAt?: Date;           // Wanneer het ingepland werd
  isScheduled: boolean;         // Of de taak ingepland is
  schedulingDeadline?: Date;    // Vrijdag 19:00 van de betreffende week

  // Extra informatie
  notes?: string;
  attachments?: string[];  // URLs naar bijlagen

  // Tags voor filtering
  tags?: string[];

  // ✅ Push notificaties - deadline reminder tracking
  // Gezet wanneer de 1-uur-voor-deadline push is verstuurd. Wordt gereset
  // wanneer dueDate in de toekomst opschuift voorbij de 1-uur-threshold.
  reminderSentAt?: Date;

  // Per-medewerker voltooiingstracking voor gedeelde taken
  completedByUsers?: string[];  // UIDs/employee IDs van wie de taak als voltooid markeren

  createdAt: Date;
  updatedAt: Date;
}

// ✅ NIEUW: Incoming Post Management - Fysieke post verwerking
export type PostStatus = 'new' | 'processed' | 'archived' | 'requires_action';
export type PostActionType = 'payment_required' | 'create_task' | 'file_document' | 'respond' | 'forward' | 'other';

export interface IncomingPost {
  id: string;
  userId: string;           // Uploader
  companyId: string;        // Bedrijf

  // Basis informatie
  sender: string;           // Afzender
  subject: string;          // Onderwerp/beschrijving
  receivedDate: Date;       // Ontvangstdatum
  uploadDate: Date;         // Upload datum

  // Bestand informatie
  fileUrl: string;          // URL naar foto van brief
  fileName: string;         // Originele bestandsnaam
  filePath: string;         // Relatief pad in storage

  // Optionele gegevens
  amount?: number;          // Te betalen bedrag (optioneel)
  dueDate?: Date;           // Vervaldatum (optioneel)

  // Status en acties
  status: PostStatus;
  requiresAction: boolean;
  actionType?: PostActionType;
  actionDescription?: string;

  // Gerelateerde entiteiten
  relatedTaskId?: string;   // Gekoppelde taak (als deze is aangemaakt)
  relatedInvoiceId?: string; // Gekoppelde factuur (als dit een factuur is)

  // Verwerking
  processedBy?: string;     // User ID die het heeft verwerkt
  processedDate?: Date;     // Verwerkingsdatum
  notes?: string;           // Opmerkingen

  // Metadata
  tags?: string[];          // Tags voor categorisering
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  createdAt: Date;
  updatedAt: Date;
}