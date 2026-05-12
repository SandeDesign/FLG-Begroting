import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Clock,
  CheckCircle,
  Zap,
  Factory,
  Upload,
  TrendingUp,
  Euro,
  FileText,
  Package,
  ListTodo,
  AlertCircle,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { getPendingLeaveApprovals, getAllCompanyTasks } from '../services/firebase';
import { getPendingTimesheets } from '../services/timesheetService';
import { usePageTitle } from '../contexts/PageTitleContext';
import { isWeekInQuarter, isInQuarter } from '../utils/dateFilters';

// Moet overeenkomen met wat ProjectProduction.tsx schrijft naar `productionWeeks`.
// Veld is `week` (niet weekNumber) en `totalHours` (niet totalProduced/totalValue).
interface ProductionWeek {
  id: string;
  week: number;
  year: number;
  totalHours: number;
  totalEntries: number;
  status: string;
  createdAt: any;
}

// Vaste weekly target uren per werkmaatschappij. Basisscenario: 120u/week.
// Later verplaatsbaar naar company-level instelling als gewenst.
const WEEKLY_HOURS_TARGET = 120;

const ManagerDashboard: React.FC = () => {
  const { user, adminUserId } = useAuth();
  const { selectedCompany, queryUserId, employees, selectedYear, selectedQuarter } = useApp();
  const navigate = useNavigate();
  usePageTitle('Manager Dashboard');

  const [loading, setLoading] = useState(false);
  const [pendingTimesheets, setPendingTimesheets] = useState<any[]>([]);
  const [pendingLeave, setPendingLeave] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const isRecentDate = (date: unknown, days = 7): boolean => {
    if (!date) return false;
    const d = (date as any)?.toDate ? (date as any).toDate() : new Date(date as string);
    return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24) <= days;
  };
  const [productionWeeks, setProductionWeeks] = useState<ProductionWeek[]>([]);
  const [stats, setStats] = useState({
    totalTeam: 0,
    activeMembers: 0,
    totalProduction: 0,
    totalProductionValue: 0,
  });

  const isProjectCompany = selectedCompany?.companyType === 'project' || selectedCompany?.companyType === 'work_company';

  const loadData = useCallback(async () => {
    if (!user || !selectedCompany || !queryUserId) return;

    try {
      setLoading(true);

      // Filter employees
      let filteredEmployees = employees;
      if (isProjectCompany) {
        filteredEmployees = employees.filter(emp =>
          emp.workCompanies?.includes(selectedCompany.id) ||
          emp.projectCompanies?.includes(selectedCompany.id)
        );
      } else {
        filteredEmployees = employees.filter(emp => emp.companyId === selectedCompany.id);
      }
      setTeamMembers(filteredEmployees.slice(0, 8));

      // Load production weeks — per monteur 1 doc per week, geaggregeerd naar
      // 1 team-regel per week hieronder.
      let productionData: ProductionWeek[] = [];
      let totalProductionHours = 0;
      let totalProductionValue = 0;
      const companyHourlyRate = selectedCompany.hourlyRate || 0;

      if (isProjectCompany) {
        try {
          const productionQuery = query(
            collection(db, 'productionWeeks'),
            where('companyId', '==', selectedCompany.id),
            orderBy('createdAt', 'desc')
          );
          const productionSnap = await getDocs(productionQuery);
          const allProduction = productionSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionWeek));

          // Filter op jaar + kwartaal
          const inPeriod = allProduction.filter(pw => {
            if (pw.year !== selectedYear) return false;
            return isWeekInQuarter(pw.week, selectedQuarter);
          });

          // Aggregeer per week: meerdere monteurs schrijven los
          const byWeek = new Map<number, ProductionWeek>();
          inPeriod.forEach(pw => {
            const existing = byWeek.get(pw.week);
            if (existing) {
              existing.totalHours = (existing.totalHours || 0) + (pw.totalHours || 0);
              existing.totalEntries = (existing.totalEntries || 0) + (pw.totalEntries || 0);
            } else {
              byWeek.set(pw.week, {
                id: `agg-${pw.year}-${pw.week}`,
                week: pw.week,
                year: pw.year,
                totalHours: pw.totalHours || 0,
                totalEntries: pw.totalEntries || 0,
                status: pw.status,
                createdAt: pw.createdAt,
              });
            }
          });

          productionData = Array.from(byWeek.values()).sort((a, b) => b.week - a.week);

          productionData.forEach(pw => {
            totalProductionHours += pw.totalHours || 0;
            // Omzet = uren × uurtarief × BTW (conform ProjectStatistics berekening)
            totalProductionValue += (pw.totalHours || 0) * companyHourlyRate * 1.21;
          });
        } catch (e) {
          console.log('Could not load production data:', e);
        }
      }

      // Manager ziet geen inkoop-bonnen meer op het dashboard.
      const [tsData, leaveData, tasksData] = await Promise.all([
        getPendingTimesheets(adminUserId, selectedCompany.id).catch(() => []),
        getPendingLeaveApprovals(selectedCompany.id, adminUserId).catch(() => []),
        getAllCompanyTasks(selectedCompany.id, adminUserId).catch(() => []),
      ]);
      setPendingTimesheets(tsData);
      setPendingLeave(leaveData);
      setTasks(tasksData);

      setProductionWeeks(productionData);
      setStats({
        totalTeam: filteredEmployees.length,
        activeMembers: filteredEmployees.filter(e => e.status === 'active').length,
        totalProduction: totalProductionHours,
        totalProductionValue,
      });
    } catch (error) {
      console.error('Error loading manager data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany, queryUserId, employees, isProjectCompany, selectedYear, selectedQuarter]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!selectedCompany) {
    return <div className="text-center py-12"><p className="text-gray-600 dark:text-gray-300">Selecteer een bedrijf</p></div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;
  }

  const overdueTasks = tasks.filter(t => t.status === 'overdue');
  const completedRecent = tasks.filter(t => t.status === 'completed' && isRecentDate(t.completedDate));

  type Tone = 'bronze' | 'sky' | 'emerald' | 'amber' | 'purple';
  const toneClasses: Record<Tone, { iconBg: string; iconText: string }> = {
    bronze:  { iconBg: 'bg-primary-50 dark:bg-primary-900/30',   iconText: 'text-primary-600 dark:text-primary-400' },
    sky:     { iconBg: 'bg-sky-50 dark:bg-sky-900/30',           iconText: 'text-sky-600 dark:text-sky-400' },
    emerald: { iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',   iconText: 'text-emerald-600 dark:text-emerald-400' },
    amber:   { iconBg: 'bg-amber-50 dark:bg-amber-900/30',       iconText: 'text-amber-600 dark:text-amber-400' },
    purple:  { iconBg: 'bg-purple-50 dark:bg-purple-900/30',     iconText: 'text-purple-600 dark:text-purple-400' },
  };

  const AlertBanner: React.FC<{
    tone: 'danger' | 'warning' | 'success';
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    message: string;
    onAction: () => void;
  }> = ({ tone, icon: Icon, title, message, onAction }) => {
    const toneMap = {
      danger:  { border: 'border-l-red-500',     iconBg: 'bg-red-50 dark:bg-red-900/30',         iconText: 'text-red-600 dark:text-red-400',         action: 'text-red-600 dark:text-red-400 hover:text-red-700' },
      warning: { border: 'border-l-amber-500',   iconBg: 'bg-amber-50 dark:bg-amber-900/30',     iconText: 'text-amber-600 dark:text-amber-400',     action: 'text-amber-600 dark:text-amber-400 hover:text-amber-700' },
      success: { border: 'border-l-emerald-500', iconBg: 'bg-emerald-50 dark:bg-emerald-900/30', iconText: 'text-emerald-600 dark:text-emerald-400', action: 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700' },
    }[tone];
    return (
      <div className={`bg-white dark:bg-gray-800 border-y border-r border-l-4 ${toneMap.border} border-y-gray-100 border-r-gray-100 dark:border-y-gray-700 dark:border-r-gray-700 rounded-xl shadow-xs p-4 flex items-start gap-3`}>
        <div className={`p-2 rounded-lg ${toneMap.iconBg} flex-shrink-0`}>
          <Icon className={`h-4 w-4 ${toneMap.iconText}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight">{title}</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">{message}</p>
        </div>
        <button onClick={onAction} className={`text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-colors ${toneMap.action}`}>
          Bekijk →
        </button>
      </div>
    );
  };

  const QuickAction: React.FC<{ label: string; sub: string; icon: React.ComponentType<{ className?: string }>; tone: Tone; onClick: () => void }> = ({ label, sub, icon: Icon, tone, onClick }) => {
    const c = toneClasses[tone];
    return (
      <button
        onClick={onClick}
        className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all p-5 flex flex-col items-start gap-3 text-left"
      >
        <div className={`w-11 h-11 rounded-xl ${c.iconBg} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${c.iconText}`} />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">{label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-5 pb-24 sm:pb-0">
      {/* Hero header */}
      <div className="hidden lg:block relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-6 lg:p-8 text-white shadow-glow-primary-lg">
        <div aria-hidden className="absolute -top-12 -right-12 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div aria-hidden className="absolute -bottom-12 -left-12 w-64 h-64 bg-primary-300/20 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{isProjectCompany ? 'Project Dashboard' : 'Manager Dashboard'}</h1>
              <p className="text-white/80 mt-1.5 text-sm flex items-center gap-2 tracking-tight">
                {isProjectCompany ? <Factory className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                {selectedCompany?.name || 'Bedrijf'}
              </p>
            </div>
            <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl ring-1 ring-white/25">
              {isProjectCompany ? <Factory className="h-6 w-6 text-white" /> : <Users className="h-6 w-6 text-white" />}
            </div>
          </div>

          {/* Inline stats in hero */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/12 backdrop-blur-sm rounded-xl p-3.5 ring-1 ring-white/20">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Users className="h-3.5 w-3.5 text-white/80" />
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-white/70">Team</p>
              </div>
              <p className="text-xl font-bold text-white tracking-tight">{stats.totalTeam}</p>
            </div>
            <div className="bg-white/12 backdrop-blur-sm rounded-xl p-3.5 ring-1 ring-white/20">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-white/80" />
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-white/70">Actief</p>
              </div>
              <p className="text-xl font-bold text-white tracking-tight">{stats.activeMembers}</p>
            </div>
            {isProjectCompany && (
              <>
                <div className="bg-white/12 backdrop-blur-sm rounded-xl p-3.5 ring-1 ring-white/20">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Package className="h-3.5 w-3.5 text-white/80" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-white/70">Uren</p>
                  </div>
                  <p className="text-xl font-bold text-white tracking-tight">{stats.totalProduction.toFixed(1)}u</p>
                  <p className="text-[10px] text-white/60 mt-0.5">Target: {(productionWeeks.length * WEEKLY_HOURS_TARGET).toFixed(0)}u</p>
                </div>
                <div className="bg-white/12 backdrop-blur-sm rounded-xl p-3.5 ring-1 ring-white/20">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Euro className="h-3.5 w-3.5 text-white/80" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-white/70">Omzet (incl. BTW)</p>
                  </div>
                  <p className="text-xl font-bold text-white tracking-tight">€{stats.totalProductionValue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Banners */}
      {pendingTimesheets.length + pendingLeave.length > 0 && (
        <AlertBanner
          tone="danger"
          icon={AlertCircle}
          title={`${pendingTimesheets.length + pendingLeave.length} items wachten op actie`}
          message={`${pendingTimesheets.length} uren · ${pendingLeave.length} verlof`}
          onAction={() => pendingTimesheets.length > 0 ? navigate('/timesheet-approvals') : navigate('/admin/leave-approvals')}
        />
      )}

      {overdueTasks.length > 0 && (
        <AlertBanner
          tone="warning"
          icon={AlertCircle}
          title={overdueTasks.length === 1 ? '1 taak verlopen' : `${overdueTasks.length} taken verlopen`}
          message={overdueTasks.slice(0, 3).map(t => t.title).join(' · ') + (overdueTasks.length > 3 ? ` · +${overdueTasks.length - 3} meer` : '')}
          onAction={() => navigate('/tasks')}
        />
      )}

      {completedRecent.length > 0 && (
        <AlertBanner
          tone="success"
          icon={CheckCircle}
          title={completedRecent.length === 1 ? '1 taak afgerond deze week' : `${completedRecent.length} taken afgerond deze week`}
          message={completedRecent.slice(0, 3).map(t => t.title).join(' · ')}
          onAction={() => navigate('/tasks')}
        />
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2 tracking-tight">
          <Zap className="h-4 w-4 text-amber-500" />
          Snelle acties
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {isProjectCompany ? (
            <>
              <QuickAction label="Productie"   sub="Overzicht"  icon={Factory}  tone="emerald" onClick={() => navigate('/project-production')} />
              <QuickAction label="Taken"       sub="Beheren"    icon={ListTodo} tone="amber"   onClick={() => navigate('/tasks')} />
            </>
          ) : (
            <>
              <QuickAction label="Uren"  sub="Goedkeuren" icon={Clock}    tone="bronze"  onClick={() => navigate('/timesheet-approvals')} />
              <QuickAction label="Team"  sub="Beheren"    icon={Users}    tone="sky"     onClick={() => navigate('/employees')} />
              <QuickAction label="Taken" sub="Beheren"    icon={ListTodo} tone="amber"   onClick={() => navigate('/tasks')} />
            </>
          )}
        </div>
      </div>

      {/* Production Overview */}
      {isProjectCompany && productionWeeks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 tracking-tight">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Recente productie
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Target: {WEEKLY_HOURS_TARGET}u/week · uurtarief €{(selectedCompany?.hourlyRate || 0).toFixed(2)} excl. BTW
              </p>
            </div>
            <button onClick={() => navigate('/project-production')} className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors">
              Alles bekijken →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {productionWeeks.slice(0, 6).map((week) => {
              const hours = week.totalHours || 0;
              const saldo = hours - WEEKLY_HOURS_TARGET;
              const pct = Math.min(100, Math.round((hours / WEEKLY_HOURS_TARGET) * 100));
              const saldoColor = saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
              const barColor = saldo >= 0 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : hours > 0 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-red-400 to-red-500';
              const hourlyRate = selectedCompany?.hourlyRate || 0;
              const value = hours * hourlyRate * 1.21;
              return (
                <div key={week.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xs hover:shadow-md transition-all p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-md">
                        <Factory className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">Week {week.week}</span>
                    </div>
                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                      {week.totalEntries || 0} regels
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500 dark:text-gray-400 font-medium">Uren</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                        {hours.toFixed(1)} / {WEEKLY_HOURS_TARGET}u
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} transition-all rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <div className="flex justify-between text-xs pt-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-gray-500 dark:text-gray-400">Uursaldo</span>
                    <span className={`font-semibold tabular-nums ${saldoColor}`}>
                      {saldo >= 0 ? '+' : ''}{saldo.toFixed(1)}u
                    </span>
                  </div>

                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-gray-500 dark:text-gray-400">Omzet (incl. BTW)</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      €{value.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Periode-totaal */}
          <div className="mt-4 relative bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xs overflow-hidden p-5">
            <div aria-hidden className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">
                  Totaal uren {selectedQuarter ? `Q${selectedQuarter}` : ''} {selectedYear}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tightest mt-1 tabular-nums">{stats.totalProduction.toFixed(1)}u</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">Target</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tightest mt-1 tabular-nums">{(productionWeeks.length * WEEKLY_HOURS_TARGET).toFixed(0)}u</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{productionWeeks.length} weken × {WEEKLY_HOURS_TARGET}u</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">Omzet (incl. BTW)</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tightest mt-1 tabular-nums">€{stats.totalProductionValue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Members */}
      {teamMembers.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2 tracking-tight">
            <Users className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            {isProjectCompany ? 'Werknemers' : 'Team'} <span className="font-medium text-gray-400 dark:text-gray-500">({teamMembers.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {teamMembers.map((member) => (
              <div key={member.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xs hover:shadow-md transition-all p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-glow-primary">
                    {member.personalInfo?.firstName?.[0]?.toUpperCase() || 'E'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate tracking-tight">
                      {member.personalInfo?.firstName} {member.personalInfo?.lastName}
                    </p>
                    <p className="text-xs mt-1 flex items-center gap-1">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${member.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      <span className="text-gray-500 dark:text-gray-400">{member.status === 'active' ? 'Actief' : 'Inactief'}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && productionWeeks.length === 0 && teamMembers.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <div className="mx-auto w-14 h-14 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="h-7 w-7 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1.5 tracking-tight">Nog geen data</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">Begin met het uploaden van facturen of het registreren van productie.</p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ManagerDashboard;
