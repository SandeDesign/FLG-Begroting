import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Filter, Download, Calendar, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AuditAction, AuditEntityType } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { AuditService } from '../services/auditService'; // Ensure AuditService is imported
import { EmptyState } from '../components/ui/EmptyState';
import { useApp } from '../contexts/AppContext';
import { usePageTitle } from '../contexts/PageTitleContext';

interface AuditLogEntry { // Renamed to avoid conflict with AuditLog type from types/audit.ts
  id: string;
  userId: string;
  companyId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: any;
  createdAt: Date; // Ensure this is a Date object
  severity: 'info' | 'warning' | 'critical';
  performedBy: {
    uid: string;
    email: string;
    name?: string;
    role: 'admin' | 'employee';
  };
}

const AuditLogPage: React.FC = () => {
  const { user, adminUserId } = useAuth();
  const { selectedCompany } = useApp(); // Get selected company from AppContext
  const { success, error: showError } = useToast();
  usePageTitle('Audit Log');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [fraudOnly, setFraudOnly] = useState(false);
  const [filters, setFilters] = useState<{
    entityType?: AuditEntityType;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    companyId?: string; // Add companyId to filters
  }>({});

  // Update filters when selectedCompany changes
  useEffect(() => {
    setFilters(prevFilters => ({
      ...prevFilters,
      companyId: selectedCompany?.id,
    }));
  }, [selectedCompany]);

  const loadAuditLogs = useCallback(async () => {
    if (!user || !adminUserId || !adminUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const logs = await AuditService.getAuditLogs(adminUserId, {
        ...filters,
        limit: 100, // Limit for performance
      });
      setAuditLogs(logs);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      showError('Fout bij laden', 'Kon audit logs niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, filters, showError]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const handleExport = async () => {
    if (!user || !adminUserId || !selectedCompany) {
      showError('Fout', 'Geen gebruiker of bedrijf geselecteerd voor export.');
      return;
    }

    try {
      const exportId = await AuditService.exportAuditLogs(adminUserId, selectedCompany.id, 'excel', filters);
      success('Export gestart', 'U ontvangt binnenkort een download link.');
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      showError('Fout bij exporteren', 'Kon export niet starten');
    }
  };

  const getActionLabel = (action: AuditAction): string => {
    const labels: Record<AuditAction, string> = {
      create: 'Aangemaakt',
      update: 'Bijgewerkt',
      delete: 'Verwijderd',
      view: 'Bekeken',
      export: 'Geëxporteerd',
      submit: 'Ingediend',
      approve: 'Goedgekeurd',
      reject: 'Afgewezen',
    };
    return labels[action];
  };

  const getEntityTypeLabel = (entityType: AuditEntityType): string => {
    const labels: Record<AuditEntityType, string> = {
      employee: 'Werknemer',
      company: 'Bedrijf',
      branch: 'Vestiging',
      payroll: 'Loonverwerking',
      tax_return: 'Loonaangifte',
      leave_request: 'Verlofaanvraag',
      sick_leave: 'Ziekteverlof',
      expense: 'Declaratie',
      time_entry: 'Ureninvoer',
      settings: 'Instellingen',
      user: 'Gebruiker',
    };
    return labels[entityType];
  };

  const getSeverityColor = (severity: AuditLogEntry['severity']): string => {
    const colors: Record<AuditLogEntry['severity'], string> = {
      info: 'bg-primary-100 text-primary-800 dark:bg-gray-700 dark:text-primary-400',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-gray-700 dark:text-yellow-400',
      critical: 'bg-red-100 text-red-800 dark:bg-gray-700 dark:text-red-400',
    };
    return colors[severity];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Bekijk alle acties die zijn uitgevoerd in het systeem
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={!selectedCompany}>
          <Download className="h-5 w-5 mr-2" />
          Exporteren
        </Button>
      </div>

      <Card>
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                <Filter className="h-4 w-4 inline mr-2" />
                Type entiteit
              </label>
              <select
                value={filters.entityType || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    entityType: e.target.value ? (e.target.value as AuditEntityType) : undefined,
                  })
                }
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-gray-100"
              >
                <option value="">Alle types</option>
                <option value="employee">Werknemer</option>
                <option value="company">Bedrijf</option>
                <option value="payroll">Loonverwerking</option>
                <option value="tax_return">Loonaangifte</option>
                <option value="leave_request">Verlofaanvraag</option>
                <option value="expense">Declaratie</option>
                <option value="time_entry">Ureninvoer</option>
                <option value="settings">Instellingen</option>
                <option value="user">Gebruiker</option>
              </select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Actie
              </label>
              <select
                value={filters.action || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    action: e.target.value ? (e.target.value as AuditAction) : undefined,
                  })
                }
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-gray-100"
              >
                <option value="">Alle acties</option>
                <option value="create">Aangemaakt</option>
                <option value="update">Bijgewerkt</option>
                <option value="delete">Verwijderd</option>
                <option value="view">Bekeken</option>
                <option value="export">Geëxporteerd</option>
                <option value="submit">Ingediend</option>
                <option value="approve">Goedgekeurd</option>
                <option value="reject">Afgewezen</option>
              </select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                <Calendar className="h-4 w-4 inline mr-2" />
                Start datum
              </label>
              <input
                type="date"
                value={filters.startDate?.toISOString().split('T') || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    startDate: e.target.value ? new Date(e.target.value) : undefined,
                  })
                }
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Eind datum
              </label>
              <input
                type="date"
                value={filters.endDate?.toISOString().split('T') || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    endDate: e.target.value ? new Date(e.target.value) : undefined,
                  })
                }
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Fraude-pogingen filter */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setFraudOnly(f => !f)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                fraudOnly
                  ? 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600 text-red-800 dark:text-red-300'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Shield className="h-4 w-4" />
              Fraude-pogingen
            </button>
            {fraudOnly && (
              <span className="text-xs text-red-600 dark:text-red-400">
                Toont alleen geblokkeerde "Riset" invoerpogingen
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : auditLogs.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="Geen audit logs gevonden"
              description="Geen audit logs gevonden voor de geselecteerde filters."
            />
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Datum/Tijd</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Gebruiker</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actie</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Entiteit ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ernst</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {auditLogs.filter(log => !fraudOnly || (log.metadata?.reason as string)?.startsWith('riset_attempt')).map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:bg-gray-900">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{log.createdAt.toLocaleString('nl-NL')}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{log.performedBy.name || log.performedBy.email}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-300">{log.performedBy.role}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{getActionLabel(log.action)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{getEntityTypeLabel(log.entityType)}</td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-300">
                        <div>{log.entityId.substring(0, 8)}...</div>
                        {log.metadata && (
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 space-y-0.5 font-sans">
                            {log.metadata.reason && <div><span className="font-semibold">reden:</span> {log.metadata.reason}</div>}
                            {log.metadata.field && <div><span className="font-semibold">veld:</span> {log.metadata.field}</div>}
                            {log.metadata.attemptedValue && <div><span className="font-semibold">waarde:</span> "{log.metadata.attemptedValue}"</div>}
                            {log.metadata.weekNumber && <div><span className="font-semibold">week:</span> {log.metadata.weekNumber}/{log.metadata.year}</div>}
                            {log.metadata.employeeId && <div><span className="font-semibold">medewerker:</span> {log.metadata.employeeId.substring(0, 12)}...</div>}
                            {log.metadata.previousStatus && <div><span className="font-semibold">vorige status:</span> {log.metadata.previousStatus}</div>}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(log.severity)}`}>{log.severity}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobiele cards */}
            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {auditLogs.filter(log => !fraudOnly || (log.metadata?.reason as string)?.startsWith('riset_attempt')).map((log) => (
                <div key={log.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{log.performedBy.name || log.performedBy.email}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getSeverityColor(log.severity)}`}>{log.severity}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-gray-700 dark:text-gray-200">{getActionLabel(log.action)}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500 dark:text-gray-300">{getEntityTypeLabel(log.entityType)}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-300">
                    {log.createdAt.toLocaleString('nl-NL')}
                  </div>
                  {log.metadata && (
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 space-y-0.5">
                      {log.metadata.reason && <div><span className="font-semibold">reden:</span> {log.metadata.reason}</div>}
                      {log.metadata.field && <div><span className="font-semibold">veld:</span> {log.metadata.field}</div>}
                      {log.metadata.attemptedValue && <div><span className="font-semibold">waarde:</span> "{log.metadata.attemptedValue}"</div>}
                      {log.metadata.weekNumber && <div><span className="font-semibold">week:</span> {log.metadata.weekNumber}/{log.metadata.year}</div>}
                      {log.metadata.previousStatus && <div><span className="font-semibold">vorige status:</span> {log.metadata.previousStatus}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            </>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Statistieken
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">
                Totaal acties
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                {auditLogs.length}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">
                Kritieke acties
              </p>
              <p className="mt-2 text-3xl font-bold text-red-600">
                {auditLogs.filter((log) => log.severity === 'critical').length}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-200">
                Unieke gebruikers
              </p>
              <p className="mt-2 text-3xl font-bold text-primary-600">
                {new Set(auditLogs.map((log) => log.performedBy.uid)).size}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AuditLogPage;