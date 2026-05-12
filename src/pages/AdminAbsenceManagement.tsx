import React, { useEffect, useState, useCallback } from 'react';
import { HeartPulse, AlertTriangle, Calendar, User, Clock, Building2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { SickLeave, Employee } from '../types';
import * as firebaseService from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useToast } from '../hooks/useToast';
import { usePageTitle } from '../contexts/PageTitleContext';

const AdminAbsenceManagement: React.FC = () => {
  const { user, adminUserId } = useAuth();
  const { companies, employees, selectedCompany } = useApp();
  const { success, error: showError } = useToast();
  usePageTitle('Verzuim Beheren');
  const [loading, setLoading] = useState(true);
  const [activeSickLeave, setActiveSickLeave] = useState<SickLeave[]>([]);

  const loadActiveSickLeave = useCallback(async () => {
    if (!user || !adminUserId || !selectedCompany) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Get ALL sick leave records for this user and filter for active
      const allSickLeaveRecords = await firebaseService.getSickLeaveRecords(adminUserId);
      const active = allSickLeaveRecords.filter(record => 
        (record.status === 'active' || record.status === 'partially_recovered') && record.companyId === selectedCompany.id
      );
      setActiveSickLeave(active);
    } catch (err) {
      console.error('Error loading active sick leave:', err);
      showError('Fout bij laden', 'Kon verzuimgegevens niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, adminUserId, selectedCompany, showError]);

  useEffect(() => {
    loadActiveSickLeave();
  }, [loadActiveSickLeave]);

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee 
      ? `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`
      : 'Onbekende werknemer';
  };

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Onbekend bedrijf';
  };

  const getDaysSick = (startDate: Date, endDate?: Date) => {
    const end = endDate || new Date();
    const diffTime = end.getTime() - new Date(startDate).getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      case 'partially_recovered':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'long_term':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      active: 'Actief',
      partially_recovered: 'Gedeeltelijk hersteld',
      long_term: 'Langdurig',
    };
    return statusMap[status] || status;
  };

  const longTermCases = activeSickLeave.filter(leave => getDaysSick(leave.startDate) > 42);
  const poortwachterCases = activeSickLeave.filter(leave => leave.poortwachterActive);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!selectedCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Geen bedrijf geselecteerd"
        description="Selecteer een bedrijf om verzuim te beheren."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="hidden lg:flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Verzuim Beheren
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Overzicht van actief verzuim en re-integratie
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Actief verzuim',    value: activeSickLeave.length,  icon: HeartPulse,     stripe: 'from-red-400 to-red-600',         iconBg: 'bg-red-50 dark:bg-red-900/30',         iconText: 'text-red-600 dark:text-red-400' },
          { label: 'Langdurig (>6 wk)', value: longTermCases.length,    icon: AlertTriangle,  stripe: 'from-amber-400 to-amber-600',     iconBg: 'bg-amber-50 dark:bg-amber-900/30',     iconText: 'text-amber-600 dark:text-amber-400' },
          { label: 'Poortwachter',      value: poortwachterCases.length, icon: Clock,         stripe: 'from-primary-400 to-primary-600', iconBg: 'bg-primary-50 dark:bg-primary-900/30', iconText: 'text-primary-600 dark:text-primary-400' },
          { label: 'Werknemers',        value: employees.length,         icon: User,          stripe: 'from-emerald-400 to-emerald-600', iconBg: 'bg-emerald-50 dark:bg-emerald-900/30', iconText: 'text-emerald-600 dark:text-emerald-400' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs hover:shadow-md transition-all p-5 overflow-hidden">
              <div aria-hidden className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${stat.stripe}`} />
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
                <span className={`w-5 h-5 rounded-md ${stat.iconBg} flex items-center justify-center`}>
                  <Icon className={`h-3 w-3 ${stat.iconText}`} />
                </span>
                {stat.label}
              </p>
              <p className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tightest leading-none tabular-nums">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <Card>
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Actief Verzuim
          </h2>
        </div>

        {activeSickLeave.length === 0 ? (
          <EmptyState
            icon={HeartPulse}
            title="Geen actief verzuim"
            description="Er zijn momenteel geen werknemers met actief verzuim"
            actionLabel=""
            onAction={() => {}}
          />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Werknemer</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Bedrijf</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Start Datum</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Dagen Ziek</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Arbeidsgeschiktheid</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Poortwachter</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {activeSickLeave.map((sickLeave) => {
                  const daysSick = getDaysSick(sickLeave.startDate, sickLeave.endDate);
                  const isLongTerm = daysSick > 42;
                  return (
                    <tr key={sickLeave.id} className="hover:bg-gray-50 dark:bg-gray-900 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-2" />
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{getEmployeeName(sickLeave.employeeId)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{getCompanyName(sickLeave.companyId)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{new Date(sickLeave.startDate).toLocaleDateString('nl-NL')}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium ${isLongTerm ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'}`}>{daysSick} dagen</span>
                          {isLongTerm && <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 ml-2" />}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{sickLeave.workCapacityPercentage}%</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(sickLeave.status)}`}>{getStatusText(sickLeave.status)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {sickLeave.poortwachterActive ? (
                          <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 rounded-full">
                            <Clock className="h-3 w-3 mr-1" />Actief
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-300">Niet actief</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobiele cards */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
            {activeSickLeave.map((sickLeave) => {
              const daysSick = getDaysSick(sickLeave.startDate, sickLeave.endDate);
              const isLongTerm = daysSick > 42;
              return (
                <div key={sickLeave.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <User className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{getEmployeeName(sickLeave.employeeId)}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(sickLeave.status)}`}>{getStatusText(sickLeave.status)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-300">
                    <span>{getCompanyName(sickLeave.companyId)}</span>
                    <span>{new Date(sickLeave.startDate).toLocaleDateString('nl-NL')}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-medium ${isLongTerm ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {daysSick} dagen {isLongTerm && '⚠️'}
                    </span>
                    <span className="text-gray-500 dark:text-gray-300">{sickLeave.workCapacityPercentage}% geschikt</span>
                    {sickLeave.poortwachterActive && (
                      <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 rounded-full">
                        <Clock className="h-3 w-3 mr-0.5" />PW
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </Card>

      {/* Alerts for long-term cases */}
      {longTermCases.length > 0 && (
        <Card>
          <div className="p-6 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Aandachtspunten
              </h2>
            </div>
          </div>
          <div className="p-6">
            <div className="bg-orange-50 dark:bg-gray-700 border border-orange-200 dark:border-orange-700 rounded-xl p-4">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                <strong>{longTermCases.length} werknemers</strong> zijn langer dan 6 weken ziek. 
                Overweeg contact op te nemen met de arbodienst en activeer de poortwachter procedure indien nog niet gedaan.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AdminAbsenceManagement;