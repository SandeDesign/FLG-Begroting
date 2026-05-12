import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Clock,
  Calendar,
  Euro,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Wallet,
  Receipt,
  FileText,
  BarChart3,
  Activity,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';
import {
  getEmployees,
  getBudgetItems,
  getPendingExpenses,
  getPendingLeaveApprovals,
  getAllCompanyTasks,
} from '../services/firebase';
import { getPendingTimesheets } from '../services/timesheetService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { usePageTitle } from '../contexts/PageTitleContext';

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  pendingTimesheets: number;
  pendingLeaveRequests: number;
  pendingExpenses: number;
  totalPendingExpenseAmount: number;
  monthlyBudgetIncome: number;
  monthlyBudgetCosts: number;
  monthlyBudgetProfit: number;
  overtimeHoursThisWeek: number;
}

// Brand-aligned chart palette
const COLORS = ['#cd853f', '#995a32', '#22c55e', '#f59e0b', '#ef4444'];

const AdminDashboard: React.FC = () => {
  const { user, adminUserId } = useAuth();
  const { employees, selectedCompany } = useApp();
  const { error: showError } = useToast();
  usePageTitle('LoonMaatschappij');
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [budgetChartData, setBudgetChartData] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  const isRecentDate = (date: unknown, days = 7): boolean => {
    if (!date) return false;
    const d = (date as any)?.toDate ? (date as any).toDate() : new Date(date as string);
    return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24) <= days;
  };

  const loadDashboardData = useCallback(async () => {
    if (!user || !adminUserId || !selectedCompany) {
      console.log('❌ No user or company selected');
      return;
    }

    try {
      setLoading(true);
      console.log('📊 Loading dashboard for company:', selectedCompany.name);

      const companyEmployees = await getEmployees(adminUserId);
      console.log('👥 Employees loaded:', companyEmployees.length);

      const activeEmployees = companyEmployees.filter(e => e.status === 'active' && e.companyId === selectedCompany.id);
      console.log('✅ Active employees:', activeEmployees.length);

      const [pendingTimesheets, pendingLeave, pendingExpenses, budgetItems] = await Promise.all([
        getPendingTimesheets(adminUserId, selectedCompany.id),
        getPendingLeaveApprovals(selectedCompany.id, adminUserId),
        getPendingExpenses(selectedCompany.id, adminUserId).catch(() => []),
        getBudgetItems(adminUserId, selectedCompany.id).catch(() => []),
      ]);

      console.log('⏱️ Pending timesheets:', pendingTimesheets.length);
      console.log('📅 Pending leave:', pendingLeave.length);
      console.log('💰 Pending expenses:', pendingExpenses.length);
      console.log('📊 Budget items:', budgetItems.length);

      const totalPendingExpenseAmount = pendingExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

      let monthlyIncome = 0;
      let monthlyCosts = 0;
      const activeBudgetItems = budgetItems.filter(item => item.isActive !== false);

      activeBudgetItems.forEach(item => {
        const monthlyAmount = item.frequency === 'monthly' ? item.amount :
                            item.frequency === 'yearly' ? item.amount / 12 :
                            item.frequency === 'quarterly' ? item.amount / 3 :
                            item.amount;

        if (item.type === 'income') {
          monthlyIncome += monthlyAmount;
        } else {
          monthlyCosts += monthlyAmount;
        }
      });

      console.log('💵 Monthly income:', monthlyIncome);
      console.log('💸 Monthly costs:', monthlyCosts);

      const newStats: DashboardStats = {
        totalEmployees: companyEmployees.filter(e => e.companyId === selectedCompany.id).length,
        activeEmployees: activeEmployees.length,
        pendingTimesheets: pendingTimesheets.length,
        pendingLeaveRequests: pendingLeave.length,
        pendingExpenses: pendingExpenses.length,
        totalPendingExpenseAmount,
        monthlyBudgetIncome: monthlyIncome,
        monthlyBudgetCosts: monthlyCosts,
        monthlyBudgetProfit: monthlyIncome - monthlyCosts,
        overtimeHoursThisWeek: 0,
      };

      setStats(newStats);

      const chartDataArray = [
        { name: 'Uren', value: pendingTimesheets.length, color: COLORS[0] },
        { name: 'Verlof', value: pendingLeave.length, color: COLORS[1] },
        { name: 'Onkosten', value: pendingExpenses.length, color: COLORS[2] },
      ];

      console.log('📈 Chart data:', chartDataArray);
      setChartData(chartDataArray);

      const budgetDataArray = [
        { name: 'Inkomsten', value: monthlyIncome, fill: '#10b981' },
        { name: 'Kosten', value: monthlyCosts, fill: '#ef4444' },
      ];

      console.log('💰 Budget chart data:', budgetDataArray);
      setBudgetChartData(budgetDataArray);

      const tasksData = await getAllCompanyTasks(selectedCompany.id, adminUserId).catch(() => []);
      setTasks(tasksData);

      console.log('✅ Dashboard loaded successfully');

    } catch (error) {
      console.error('❌ Error loading dashboard:', error);
      showError('Fout', 'Kon dashboard data niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, adminUserId, selectedCompany?.id, showError]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadDashboardData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!stats || !selectedCompany) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight">Selecteer een bedrijf</h3>
      </div>
    );
  }

  const totalPending = stats.pendingTimesheets + stats.pendingLeaveRequests + stats.pendingExpenses;
  const overdueTasks = tasks.filter(t => t.status === 'overdue');
  const completedRecent = tasks.filter(t => t.status === 'completed' && isRecentDate(t.completedDate));

  type StatTone = 'bronze' | 'sky' | 'purple' | 'emerald';
  const toneClasses: Record<StatTone, { stripe: string; iconBg: string; iconText: string }> = {
    bronze:  { stripe: 'from-primary-400 to-primary-600',  iconBg: 'bg-primary-50 dark:bg-primary-900/30',  iconText: 'text-primary-600 dark:text-primary-400' },
    sky:     { stripe: 'from-sky-400 to-sky-600',          iconBg: 'bg-sky-50 dark:bg-sky-900/30',          iconText: 'text-sky-600 dark:text-sky-400' },
    purple:  { stripe: 'from-purple-400 to-purple-600',    iconBg: 'bg-purple-50 dark:bg-purple-900/30',    iconText: 'text-purple-600 dark:text-purple-400' },
    emerald: { stripe: 'from-emerald-400 to-emerald-600',  iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',  iconText: 'text-emerald-600 dark:text-emerald-400' },
  };

  const StatTile: React.FC<{
    label: string;
    value: React.ReactNode;
    sub?: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: StatTone;
    badgeCount?: number;
    onClick?: () => void;
  }> = ({ label, value, sub, icon: Icon, tone, badgeCount, onClick }) => {
    const c = toneClasses[tone];
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs p-5 text-left overflow-hidden transition-all duration-200 ${onClick ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'}`}
      >
        <div aria-hidden className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${c.stripe}`} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-md ${c.iconBg} flex items-center justify-center`}>
                <Icon className={`h-3 w-3 ${c.iconText}`} />
              </span>
              {label}
            </p>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tightest leading-none">{value}</p>
            {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{sub}</p>}
          </div>
          {typeof badgeCount === 'number' && badgeCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center flex-shrink-0 ring-2 ring-white dark:ring-gray-800">
              {badgeCount}
            </span>
          )}
        </div>
      </button>
    );
  };

  const AlertBanner: React.FC<{
    tone: 'danger' | 'warning' | 'success';
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    message: string;
    actionLabel: string;
    onAction: () => void;
  }> = ({ tone, icon: Icon, title, message, actionLabel, onAction }) => {
    const toneMap = {
      danger:  { border: 'border-l-red-500',     iconBg: 'bg-red-50 dark:bg-red-900/30',     iconText: 'text-red-600 dark:text-red-400',         action: 'text-red-600 dark:text-red-400 hover:text-red-700' },
      warning: { border: 'border-l-amber-500',   iconBg: 'bg-amber-50 dark:bg-amber-900/30', iconText: 'text-amber-600 dark:text-amber-400',     action: 'text-amber-600 dark:text-amber-400 hover:text-amber-700' },
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
        <button
          onClick={onAction}
          className={`text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-colors ${toneMap.action}`}
        >
          {actionLabel}
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-24 sm:pb-6">
      {/* Hero */}
      <div className="hidden lg:block relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-6 lg:p-8 text-white shadow-glow-primary-lg">
        <div aria-hidden className="absolute -top-12 -right-12 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div aria-hidden className="absolute -bottom-12 -left-12 w-64 h-64 bg-primary-300/20 rounded-full blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">LoonMaatschappij</h1>
            <p className="text-white/80 mt-1.5 text-sm tracking-tight">{selectedCompany.name}</p>
          </div>
          <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl ring-1 ring-white/25">
            <Activity className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>

      {/* Banners */}
      {totalPending > 0 && (
        <AlertBanner
          tone="danger"
          icon={AlertCircle}
          title={`${totalPending} items wachten op actie`}
          message={`${stats.pendingTimesheets} uren · ${stats.pendingLeaveRequests} verlof · ${stats.pendingExpenses} onkosten`}
          actionLabel="Bekijk"
          onAction={() => navigate('/timesheet-approvals')}
        />
      )}

      {overdueTasks.length > 0 && (
        <AlertBanner
          tone="warning"
          icon={AlertCircle}
          title={overdueTasks.length === 1 ? '1 taak verlopen' : `${overdueTasks.length} taken verlopen`}
          message={overdueTasks.slice(0, 3).map(t => t.title).join(' · ') + (overdueTasks.length > 3 ? ` · +${overdueTasks.length - 3} meer` : '')}
          actionLabel="Bekijk"
          onAction={() => navigate('/tasks')}
        />
      )}

      {completedRecent.length > 0 && (
        <AlertBanner
          tone="success"
          icon={CheckCircle}
          title={completedRecent.length === 1 ? '1 taak afgerond deze week' : `${completedRecent.length} taken afgerond deze week`}
          message={completedRecent.slice(0, 3).map(t => t.title).join(' · ')}
          actionLabel="Bekijk"
          onAction={() => navigate('/tasks')}
        />
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Actieve medewerkers"
          value={stats.activeEmployees}
          sub={`van ${stats.totalEmployees} totaal`}
          icon={Users}
          tone="sky"
        />
        <StatTile
          label="Uren wachtend"
          value={stats.pendingTimesheets}
          sub="te goedkeuren"
          icon={Clock}
          tone="bronze"
          badgeCount={stats.pendingTimesheets}
          onClick={() => navigate('/timesheet-approvals')}
        />
        <StatTile
          label="Verlof wachtend"
          value={stats.pendingLeaveRequests}
          sub="aanvragen"
          icon={Calendar}
          tone="purple"
          badgeCount={stats.pendingLeaveRequests}
          onClick={() => navigate('/admin/leave-approvals')}
        />
        <StatTile
          label="Onkosten"
          value={<span>€{(stats.totalPendingExpenseAmount / 100).toFixed(0)}</span>}
          sub={`${stats.pendingExpenses} in behandeling`}
          icon={Receipt}
          tone="emerald"
          badgeCount={stats.pendingExpenses}
          onClick={() => navigate('/admin-expenses')}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 tracking-tight">
            <span className="p-1.5 rounded-md bg-primary-50 dark:bg-primary-900/30">
              <BarChart3 className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
            </span>
            Openstaande items
          </h2>
          {totalPending > 0 ? (
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-900/10 ring-1 ring-emerald-200 dark:ring-emerald-700 rounded-2xl flex items-center justify-center mb-3">
                <CheckCircle className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 tracking-tight">Alles verwerkt</p>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 tracking-tight">
            <span className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30">
              <Wallet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </span>
            Maandelijkse begroting
          </h2>
          {stats.monthlyBudgetIncome > 0 || stats.monthlyBudgetCosts > 0 ? (
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={budgetChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => `€${value.toLocaleString('nl-NL')}`} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {budgetChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-56 text-gray-400 dark:text-gray-500">
              <div className="w-14 h-14 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 rounded-2xl flex items-center justify-center mb-3">
                <Wallet className="h-7 w-7 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 tracking-tight">Geen begroting ingesteld</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">Inkomsten</p>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5">€{stats.monthlyBudgetIncome.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">Kosten</p>
              <p className="text-base font-bold text-red-600 dark:text-red-400 tracking-tight mt-0.5">€{stats.monthlyBudgetCosts.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">Winst</p>
              <p className={`text-base font-bold tracking-tight mt-0.5 ${stats.monthlyBudgetProfit >= 0 ? 'text-primary-600 dark:text-primary-400' : 'text-red-600 dark:text-red-400'}`}>
                {stats.monthlyBudgetProfit >= 0 ? '+' : ''}€{stats.monthlyBudgetProfit.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4 tracking-tight">Snelle acties</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { title: 'Uren goedkeuren',  count: stats.pendingTimesheets,    icon: Clock,    path: '/timesheet-approvals',  tone: 'bronze' as StatTone },
            { title: 'Verlof goedkeuren', count: stats.pendingLeaveRequests, icon: Calendar, path: '/admin/leave-approvals', tone: 'purple' as StatTone },
            { title: 'Team beheren',      icon: Users,    path: '/employees',                                                tone: 'sky' as StatTone },
            { title: 'Begroting',         icon: Wallet,   path: '/budgeting',                                                tone: 'emerald' as StatTone },
          ].map((action) => {
            const Icon = action.icon;
            const c = toneClasses[action.tone];
            return (
              <button
                key={action.title}
                onClick={() => navigate(action.path)}
                className="group relative bg-white dark:bg-gray-700/40 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-500 hover:shadow-md hover:-translate-y-0.5 transition-all p-4 flex flex-col items-center gap-2 text-center"
              >
                <div className={`w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${c.iconText}`} />
                </div>
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 tracking-tight">{action.title}</p>
                {action.count !== undefined && action.count > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                    {action.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default AdminDashboard;
