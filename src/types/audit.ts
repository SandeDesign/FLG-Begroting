export interface AuditLog {
  id: string;
  userId: string;
  companyId?: string;

  action: 'create' | 'update' | 'delete' | 'view' | 'export' | 'submit' | 'approve' | 'reject';

  entityType:
    | 'employee'
    | 'company'
    | 'branch'
    | 'payroll'
    | 'tax_return'
    | 'leave_request'
    | 'sick_leave'
    | 'expense'
    | 'time_entry'
    | 'settings'
    | 'vehicle'
    | 'vehicle_report'
    | 'user';

  entityId: string;

  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];

  metadata?: {
    ip?: string;
    userAgent?: string;
    location?: string;
    sessionId?: string;
    reason?: string;
    [key: string]: any;
  };

  severity: 'info' | 'warning' | 'critical';

  performedBy: {
    uid: string;
    email: string;
    name?: string;
    role: 'admin' | 'employee';
  };

  checksum?: string;

  createdAt: Date;
}

export interface ComplianceReport {
  id: string;
  companyId: string;
  userId: string;

  reportType:
    | 'data_retention'
    | 'payroll_accuracy'
    | 'tax_compliance'
    | 'labor_inspection'
    | 'audit_trail'
    | 'employee_records';

  period: {
    startDate: Date;
    endDate: Date;
  };

  findings: {
    category: string;
    severity: 'info' | 'warning' | 'critical';
    description: string;
    recommendation?: string;
    resolved: boolean;
    resolvedAt?: Date;
  }[];

  summary: {
    totalChecks: number;
    passed: number;
    warnings: number;
    critical: number;
  };

  generatedBy: string;
  generatedAt: Date;

  exportedFormats: {
    format: 'pdf' | 'excel' | 'json';
    filename: string;
    exportedAt: Date;
  }[];

  createdAt: Date;
}

export interface DataRetentionPolicy {
  id: string;
  companyId: string;

  entityType: AuditLog['entityType'];

  retentionPeriodYears: number;

  archiveAfterYears?: number;

  deleteAfterYears?: number;

  exceptions?: {
    condition: string;
    extendedRetentionYears: number;
    reason: string;
  }[];

  lastEnforcedAt?: Date;

  active: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface DataRetentionStatus {
  companyId: string;

  entityType: AuditLog['entityType'];

  counts: {
    total: number;
    active: number;
    toArchive: number;
    toDelete: number;
    archived: number;
  };

  oldestRecord?: Date;
  newestRecord?: Date;

  nextScheduledRun: Date;

  calculatedAt: Date;
}

export interface AuditExport {
  id: string;
  companyId: string;
  userId: string;

  exportType: 'audit_logs' | 'compliance_report' | 'retention_status' | 'full_audit';

  filters: {
    startDate?: Date;
    endDate?: Date;
    entityType?: AuditLog['entityType'];
    action?: AuditLog['action'];
    userId?: string;
  };

  format: 'excel' | 'csv' | 'json' | 'pdf';

  filename: string;
  fileSize?: number;
  downloadUrl?: string;

  status: 'pending' | 'processing' | 'completed' | 'failed';

  error?: string;

  requestedBy: string;
  requestedAt: Date;
  completedAt?: Date;

  expiresAt: Date;

  createdAt: Date;
}

export type AuditAction = AuditLog['action'];
export type AuditEntityType = AuditLog['entityType'];
export type AuditSeverity = AuditLog['severity'];
export type ComplianceReportType = ComplianceReport['reportType'];
