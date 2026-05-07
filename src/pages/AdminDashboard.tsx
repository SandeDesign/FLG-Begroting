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

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

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
        <AlertCircle className="mx-auto h-12 w-12 text-red-600" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Selecteer een bedrijf</h3>
      </div>
    );
  }

  const totalPending = stats.pendingTimesheets + stats.pendingLeaveRequests + stats.pendingExpenses;

  return (
    <div className="space-y-6 pb-24 sm:pb-6">
      <div className="hidden lg:block bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-700 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800 dark:border dark:border-gray-700 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">LoonMaatschappij</h1>
            <p className="text-blue-100 dark:text-gray-300 mt-1">{selectedCompany.name}</p>
          </div>
          <Activity className="h-12 w-12 text-blue-200 dark:text-gray-500" />
        </div>
      </div>

      {totalPending > 0 && (
        <div className="bg-red-50 dark:bg-gray-800 border-l-4 border-red-500 dark:border-red-500 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900 dark:text-gray-100">{totalPending} items wachten!</h3>
            <p className="text-xs text-red-700 dark:text-gray-300 mt-1">
              {stats.pendingTimesheets} uren • {stats.pendingLeaveRequests} verlof • {stats.pendingExpenses} onkosten
            </p>
          </div>
          <button
            onClick={() => navigate('/timesheet-approvals')}
            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-semibold text-sm whitespace-nowrap"
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
              {tasks.filter(t => t.status === 'overdue').length === 1
                ? '1 taak verlopen'
                : `${tasks.filter(t => t.status === 'overdue').length} taken verlopen`}
            </h3>
            <p className="text-xs text-orange-700 dark:text-gray-300 mt-1">
              {tasks.filter(t => t.status === 'overdue').slice(0, 3).map(t => t.title).join(' • ')}
              {tasks.filter(t => t.status === 'overdue').length > 3 && ` • +${tasks.filter(t => t.status === 'overdue').length - 3} meer`}
            </p>
          </div>
          <button
            onClick={() => navigate('/tasks')}
            className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-semibold text-sm whitespace-nowrap"
          >
            Bekijk →
          </button>
        </div>
      )}

      {/* Recent afgeronde taken */}
      {tasks.filter(t => t.status === 'completed' && isRecentDate(t.completedDate)).length > 0 && (
        <div className="bg-green-50 dark:bg-gray-800 border-l-4 border-green-500 dark:border-green-500 p-4 rounded-lg flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-green-900 dark:text-gray-100">
              {tasks.filter(t => t.status === 'completed' && isRecentDate(t.completedDate)).length === 1
                ? '1 taak afgerond deze week'
                : `${tasks.filter(t => t.status === 'completed' && isRecentDate(t.completedDate)).length} taken afgerond deze week`}
            </h3>
            <p className="text-xs text-green-700 dark:text-gray-300 mt-1">
              {tasks.filter(t => t.status === 'completed' && isRecentDate(t.completedDate)).slice(0, 3).map(t => t.title).join(' • ')}
            </p>
          </div>
          <button
            onClick={() => navigate('/tasks')}
            className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-semibold text-sm whitespace-nowrap"
          >
            Bekijk →
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 bg-blue-50 dark:bg-gray-800 border-blue-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-blue-700 dark:text-gray-300">Actieve Medewerkers</p>
              <p className="text-3xl font-bold text-blue-900 dark:text-gray-100 mt-2">{stats.activeEmployees}</p>
              <p className="text-xs text-blue-600 dark:text-gray-500 mt-1">van {stats.totalEmployees} totaal</p>
            </div>
            <Users className="h-10 w-10 text-blue-400 dark:text-blue-500" />
          </div>
        </Card>

        <Card
          className="p-6 bg-orange-50 dark:bg-gray-800 border-orange-200 dark:border-gray-700 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/timesheet-approvals')}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-orange-700 dark:text-gray-300">Uren Wachten</p>
              <p className="text-3xl font-bold text-orange-900 dark:text-gray-100 mt-2">{stats.pendingTimesheets}</p>
              <p className="text-xs text-orange-600 dark:text-gray-500 mt-1">te goedkeuren</p>
            </div>
            <div className="relative">
              <Clock className="h-10 w-10 text-orange-400 dark:text-orange-500" />
              {stats.pendingTimesheets > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {stats.pendingTimesheets}
                </span>
              )}
            </div>
          </div>
        </Card>

        <Card
          className="p-6 bg-purple-50 dark:bg-gray-800 border-purple-200 dark:border-gray-700 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/admin/leave-approvals')}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-purple-700 dark:text-gray-300">Verlof Wachten</p>
              <p className="text-3xl font-bold text-purple-900 dark:text-gray-100 mt-2">{stats.pendingLeaveRequests}</p>
              <p className="text-xs text-purple-600 dark:text-gray-500 mt-1">aanvragen</p>
            </div>
            <div className="relative">
              <Calendar className="h-10 w-10 text-purple-400 dark:text-purple-500" />
              {stats.pendingLeaveRequests > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {stats.pendingLeaveRequests}
                </span>
              )}
            </div>
          </div>
        </Card>

        <Card
          className="p-6 bg-green-50 dark:bg-gray-800 border-green-200 dark:border-gray-700 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/admin-expenses')}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-green-700 dark:text-gray-300">Onkosten</p>
              <p className="text-3xl font-bold text-green-900 dark:text-gray-100 mt-2">€{(stats.totalPendingExpenseAmount / 100).toFixed(0)}</p>
              <p className="text-xs text-green-600 dark:text-gray-500 mt-1">{stats.pendingExpenses} in behandeling</p>
            </div>
            <div className="relative">
              <Receipt className="h-10 w-10 text-green-400 dark:text-green-500" />
              {stats.pendingExpenses > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {stats.pendingExpenses}
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Pending Items Overzicht
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
              <CheckCircle className="h-16 w-16 mb-3" />
              <p className="text-sm font-medium">Alles verwerkt!</p>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-600" />
            Maandelijkse Begroting
          </h2>
          {stats.monthlyBudgetIncome > 0 || stats.monthlyBudgetCosts > 0 ? (
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <BarChart data={budgetChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`} />
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
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500">
              <Wallet className="h-16 w-16 mb-3" />
              <p className="text-sm font-medium">Geen begroting ingesteld</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center">
              <p className="text-xs text-gray-600 dark:text-gray-300">Inkomsten</p>
              <p className="text-lg font-bold text-green-600">€{stats.monthlyBudgetIncome.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-600 dark:text-gray-300">Kosten</p>
              <p className="text-lg font-bold text-red-600">€{stats.monthlyBudgetCosts.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-600 dark:text-gray-300">Winst</p>
              <p className={`text-lg font-bold ${stats.monthlyBudgetProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {stats.monthlyBudgetProfit >= 0 ? '+' : ''}€{stats.monthlyBudgetProfit.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Snelle Acties</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              title: 'Uren Goedkeuren',
              count: stats.pendingTimesheets,
              icon: Clock,
              path: '/timesheet-approvals',
              color: 'blue',
            },
            {
              title: 'Verlof Goedkeuren',
              count: stats.pendingLeaveRequests,
              icon: Calendar,
              path: '/admin/leave-approvals',
              color: 'purple',
            },
            {
              title: 'Team Beheren',
              icon: Users,
              path: '/employees',
              color: 'green',
            },
            {
              title: 'Begroting',
              icon: Wallet,
              path: '/budgeting',
              color: 'emerald',
            },
          ].map((action) => {
            const Icon = action.icon;
            const colorClasses = {
              blue: 'bg-blue-50 dark:bg-gray-800 border-blue-200 dark:border-gray-700 hover:bg-blue-100 dark:hover:bg-gray-700 text-blue-700 dark:text-blue-400',
              purple: 'bg-purple-50 dark:bg-gray-800 border-purple-200 dark:border-gray-700 hover:bg-purple-100 dark:hover:bg-gray-700 text-purple-700 dark:text-purple-400',
              green: 'bg-green-50 dark:bg-gray-800 border-green-200 dark:border-gray-700 hover:bg-green-100 dark:hover:bg-gray-700 text-green-700 dark:text-green-400',
              emerald: 'bg-emerald-50 dark:bg-gray-800 border-emerald-200 dark:border-gray-700 hover:bg-emerald-100 dark:hover:bg-gray-700 text-emerald-700 dark:text-emerald-400',
            };

            return (
              <button
                key={action.title}
                onClick={() => navigate(action.path)}
                className={`relative p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 text-center ${colorClasses[action.color as keyof typeof colorClasses]}`}
              >
                <Icon className="h-6 w-6" />
                <p className="text-xs font-medium line-clamp-1">{action.title}</p>
                {action.count !== undefined && action.count > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
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
