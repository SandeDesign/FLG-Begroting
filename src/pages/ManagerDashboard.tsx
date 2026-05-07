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

  return (
    <div className="space-y-8 pb-24 sm:pb-0">
      {/* Header */}
      <div className={`hidden lg:block bg-gradient-to-r ${isProjectCompany ? 'from-emerald-600 to-emerald-700' : 'from-indigo-600 to-indigo-700'} dark:from-gray-800 dark:to-gray-800 dark:border dark:border-gray-700 rounded-2xl p-8 text-white shadow-lg`}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">{isProjectCompany ? 'Project Dashboard' : 'Manager Dashboard'}</h1>
            <p className={`${isProjectCompany ? 'text-emerald-100' : 'text-indigo-100'} dark:text-gray-300 flex items-center gap-2`}>
              {isProjectCompany ? <Factory className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              {selectedCompany?.name || 'Bedrijf'}
            </p>
          </div>
          <div className="h-16 w-16 rounded-full bg-white/20 dark:bg-gray-700 flex items-center justify-center">
            {isProjectCompany ? <Factory className="h-8 w-8 text-white dark:text-gray-300" /> : <Users className="h-8 w-8 text-white dark:text-gray-300" />}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/20 dark:bg-gray-800/40 backdrop-blur-sm rounded-lg p-4 border border-white/30 dark:border-gray-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-white" />
              <p className="text-xs text-white/90">Team</p>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalTeam}</p>
          </div>
          <div className="bg-white/20 dark:bg-gray-800/40 backdrop-blur-sm rounded-lg p-4 border border-white/30 dark:border-gray-700/50">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-white" />
              <p className="text-xs text-white/90">Actief</p>
            </div>
            <p className="text-2xl font-bold text-white">{stats.activeMembers}</p>
          </div>
          {isProjectCompany && (
            <>
              <div className="bg-white/20 dark:bg-gray-800/40 backdrop-blur-sm rounded-lg p-4 border border-white/30 dark:border-gray-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-white" />
                  <p className="text-xs text-white/90">Uren</p>
                </div>
                <p className="text-2xl font-bold text-white">{stats.totalProduction.toFixed(1)}u</p>
                <p className="text-[10px] text-white/70">
                  Target: {(productionWeeks.length * WEEKLY_HOURS_TARGET).toFixed(0)}u ({productionWeeks.length}×{WEEKLY_HOURS_TARGET})
                </p>
              </div>
              <div className="bg-white/20 dark:bg-gray-800/40 backdrop-blur-sm rounded-lg p-4 border border-white/30 dark:border-gray-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <Euro className="h-4 w-4 text-white" />
                  <p className="text-xs text-white/90">Omzet (incl. BTW)</p>
                </div>
                <p className="text-2xl font-bold text-white">€{stats.totalProductionValue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Openstaande items */}
      {pendingTimesheets.length + pendingLeave.length > 0 && (
        <div className="bg-red-50 dark:bg-gray-800 border-l-4 border-red-500 dark:border-red-500 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900 dark:text-gray-100">
              {pendingTimesheets.length + pendingLeave.length} items wachten op actie
            </h3>
            <p className="text-xs text-red-700 dark:text-gray-300 mt-1">
              {pendingTimesheets.length} uren • {pendingLeave.length} verlof
            </p>
          </div>
          <button
            onClick={() => pendingTimesheets.length > 0 ? navigate('/timesheet-approvals') : navigate('/admin/leave-approvals')}
            className="text-red-600 dark:text-red-400 hover:text-red-700 font-semibold text-sm whitespace-nowrap"
          >
            Bekijk →
          </button>
        </div>
      )}

      {/* Verlopen taken */}
      {tasks.filter(t => t.status === 'overdue').length > 0 && (
        <div className="bg-orange-50 dark:bg-gray-800 border-l-4 border-orange-500 dark:border-orange-500 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-orange-900 dark:text-gray-100">
              {tasks.filter(t => t.status === 'overdue').length === 1 ? '1 taak verlopen' : `${tasks.filter(t => t.status === 'overdue').length} taken verlopen`}
            </h3>
            <p className="text-xs text-orange-700 dark:text-gray-300 mt-1">
              {tasks.filter(t => t.status === 'overdue').slice(0, 3).map(t => t.title).join(' • ')}
              {tasks.filter(t => t.status === 'overdue').length > 3 && ` • +${tasks.filter(t => t.status === 'overdue').length - 3} meer`}
            </p>
          </div>
          <button onClick={() => navigate('/tasks')} className="text-orange-600 dark:text-orange-400 hover:text-orange-700 font-semibold text-sm whitespace-nowrap">Bekijk →</button>
        </div>
      )}

      {/* Recent afgeronde taken */}
      {tasks.filter(t => t.status === 'completed' && isRecentDate(t.completedDate)).length > 0 && (
        <div className="bg-green-50 dark:bg-gray-800 border-l-4 border-green-500 dark:border-green-500 p-4 rounded-lg flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-green-900 dark:text-gray-100">
              {tasks.filter(t => t.status === 'completed' && isRecentDate(t.completedDate)).length === 1 ? '1 taak afgerond deze week' : `${tasks.filter(t => t.status === 'completed' && isRecentDate(t.completedDate)).length} taken afgerond deze week`}
            </h3>
            <p className="text-xs text-green-700 dark:text-gray-300 mt-1">
              {tasks.filter(t => t.status === 'completed' && isRecentDate(t.completedDate)).slice(0, 3).map(t => t.title).join(' • ')}
            </p>
          </div>
          <button onClick={() => navigate('/tasks')} className="text-green-600 dark:text-green-400 hover:text-green-700 font-semibold text-sm whitespace-nowrap">Bekijk →</button>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-500" />
          Snelle Acties
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {isProjectCompany ? (
            <>
              <button onClick={() => navigate('/project-production')} className="group">
                <div className="rounded-xl p-6 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl mb-3 group-hover:scale-110 transition-transform">
                      <Factory className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-bold text-sm mb-1">Productie</h3>
                    <p className="text-xs text-white/80">Overzicht</p>
                  </div>
                </div>
              </button>
              <button onClick={() => navigate('/tasks')} className="group">
                <div className="rounded-xl p-6 bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-4 bg-amber-100 dark:bg-amber-900/30 rounded-xl mb-3 group-hover:scale-110 transition-transform">
                      <ListTodo className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="font-bold text-sm mb-1">Taken</h3>
                    <p className="text-xs text-white/80">Beheren</p>
                  </div>
                </div>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/timesheet-approvals')} className="group">
                <div className="rounded-xl p-6 bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-4 bg-primary-100 dark:bg-primary-900/30 rounded-xl mb-3 group-hover:scale-110 transition-transform">
                      <Clock className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h3 className="font-bold text-sm mb-1">Uren</h3>
                    <p className="text-xs text-white/80">Goedkeuren</p>
                  </div>
                </div>
              </button>
              <button onClick={() => navigate('/employees')} className="group">
                <div className="rounded-xl p-6 bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-xl mb-3 group-hover:scale-110 transition-transform">
                      <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="font-bold text-sm mb-1">Team</h3>
                    <p className="text-xs text-white/80">Beheren</p>
                  </div>
                </div>
              </button>
              <button onClick={() => navigate('/tasks')} className="group">
                <div className="rounded-xl p-6 bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95">
                  <div className="flex flex-col items-center text-center">
                    <div className="p-4 bg-amber-100 dark:bg-amber-900/30 rounded-xl mb-3 group-hover:scale-110 transition-transform">
                      <ListTodo className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="font-bold text-sm mb-1">Taken</h3>
                    <p className="text-xs text-white/80">Beheren</p>
                  </div>
                </div>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Production Overview — per week: uren vs 120u-target + uursaldo + omzet */}
      {isProjectCompany && productionWeeks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                Recente Productie
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                Target: {WEEKLY_HOURS_TARGET}u/week · uurtarief €{(selectedCompany?.hourlyRate || 0).toFixed(2)} excl. BTW
              </p>
            </div>
            <button onClick={() => navigate('/project-production')} className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium">
              Alles bekijken →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {productionWeeks.slice(0, 6).map((week) => {
              const hours = week.totalHours || 0;
              const saldo = hours - WEEKLY_HOURS_TARGET;
              const pct = Math.min(100, Math.round((hours / WEEKLY_HOURS_TARGET) * 100));
              const saldoColor = saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
              const barColor = saldo >= 0 ? 'bg-emerald-500' : hours > 0 ? 'bg-amber-500' : 'bg-red-500';
              const hourlyRate = selectedCompany?.hourlyRate || 0;
              const value = hours * hourlyRate * 1.21;
              return (
                <Card key={week.id} className="p-4 hover:shadow-lg transition">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <Factory className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">Week {week.week}</span>
                    </div>
                    <span className="text-[11px] text-gray-500 dark:text-gray-300">
                      {week.totalEntries || 0} regels
                    </span>
                  </div>

                  {/* Uren vs target */}
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-300">Uren</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {hours.toFixed(1)} / {WEEKLY_HOURS_TARGET}u
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* Uursaldo */}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-300">Uursaldo</span>
                    <span className={`font-semibold ${saldoColor}`}>
                      {saldo >= 0 ? '+' : ''}{saldo.toFixed(1)}u
                    </span>
                  </div>

                  {/* Omzet */}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-300">Omzet (incl. BTW)</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      €{value.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Periode-totaal */}
          <Card className="mt-4 p-4 bg-emerald-50 dark:bg-gray-800 border-l-4 border-emerald-500">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-emerald-700 dark:text-gray-300 uppercase tracking-wider">Totaal uren {selectedQuarter ? `Q${selectedQuarter}` : ''} {selectedYear}</p>
                <p className="text-xl font-bold text-emerald-900 dark:text-gray-100">{stats.totalProduction.toFixed(1)}u</p>
              </div>
              <div>
                <p className="text-xs text-emerald-700 dark:text-gray-300 uppercase tracking-wider">Target</p>
                <p className="text-xl font-bold text-emerald-900 dark:text-gray-100">{(productionWeeks.length * WEEKLY_HOURS_TARGET).toFixed(0)}u</p>
                <p className="text-[11px] text-emerald-700 dark:text-gray-300">{productionWeeks.length} weken × {WEEKLY_HOURS_TARGET}u</p>
              </div>
              <div>
                <p className="text-xs text-emerald-700 dark:text-gray-300 uppercase tracking-wider">Omzet (incl. BTW)</p>
                <p className="text-xl font-bold text-emerald-900 dark:text-gray-100">€{stats.totalProductionValue.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Team Members */}
      {teamMembers.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Users className={`h-6 w-6 ${isProjectCompany ? 'text-emerald-600 dark:text-emerald-400' : 'text-green-600 dark:text-green-400'}`} />
            {isProjectCompany ? 'Werknemers' : 'Team'} ({teamMembers.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {teamMembers.map((member) => (
              <Card key={member.id} className="p-4 hover:shadow-lg transition">
                <div className="flex items-start gap-3">
                  <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${isProjectCompany ? 'from-emerald-400 to-emerald-600' : 'from-indigo-400 to-indigo-600'} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                    {member.personalInfo?.firstName?.[0]?.toUpperCase() || 'E'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {member.personalInfo?.firstName} {member.personalInfo?.lastName}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{member.status === 'active' ? '✓ Actief' : 'Inactief'}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && productionWeeks.length === 0 && teamMembers.length === 0 && (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Nog geen data</h3>
          <p className="text-gray-500 dark:text-gray-300">Begin met het uploaden van facturen of het registreren van productie.</p>
        </Card>
      )}
    </div>
  );
};

export default ManagerDashboard;
