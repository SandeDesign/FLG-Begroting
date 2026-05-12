import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  HeartPulse,
  Receipt,
  Clock,
  TrendingUp,
  User,
  Building2,
  CheckCircle,
  Zap,
  Target,
  Award,
  Briefcase,
  AlertCircle,
  CalendarDays,
  ListChecks,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { getEmployeeById, getLeaveRequests } from '../services/firebase';
import { getWeeklyTimesheets, getWeekNumber } from '../services/timesheetService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePageTitle } from '../contexts/PageTitleContext';
import IncompleteWeekBanner from '../components/timesheet/IncompleteWeekBanner';

const EmployeeDashboard: React.FC = () => {
  const { user, adminUserId, currentEmployeeId } = useAuth();
  const { selectedCompany } = useApp();
  usePageTitle('Mijn Dashboard');
  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [currentYear] = useState(new Date().getFullYear());
  const [currentWeek] = useState(getWeekNumber(new Date()));

  // Load employee data and timesheets
  useEffect(() => {
    const loadData = async () => {
      if (!currentEmployeeId || !adminUserId || !selectedCompany) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Get employee data
        const employee = await getEmployeeById(currentEmployeeId);
        setEmployeeData(employee);

        // Get all timesheets for employee in current year (single efficient query)
        const allTimesheets = await getWeeklyTimesheets(
          adminUserId,
          currentEmployeeId,
          currentYear
        );

        setTimesheets(allTimesheets);

        const leaves = await getLeaveRequests(adminUserId, currentEmployeeId);
        setLeaveRequests(leaves);

      } catch (error) {
        console.error('Error loading employee data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentEmployeeId, adminUserId, selectedCompany, currentYear]);

  // Calculate stats from real data
  const calculateStats = () => {
    const totalHours = timesheets.reduce((sum, ts) => sum + ts.totalRegularHours, 0);
    const totalKm = timesheets.reduce((sum, ts) => sum + ts.totalTravelKilometers, 0);
    const contractHours = employeeData?.contractInfo?.hoursPerWeek || 40;
    const approvedTimesheets = timesheets.filter(ts => ts.status === 'approved').length;
    
    return {
      totalHours: totalHours.toFixed(1),
      totalKm,
      approvedWeeks: approvedTimesheets,
      contractHours
    };
  };

  const stats = calculateStats();

  const isRecentDate = (date: unknown, days = 14): boolean => {
    if (!date) return false;
    const d = (date as any)?.toDate ? (date as any).toDate() : new Date(date as string);
    return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24) <= days;
  };

  // Chart data from real timesheets
  const hoursChartData = timesheets
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .slice(-8)
    .map(ts => ({
      week: `W${ts.weekNumber}`,
      hours: ts.totalRegularHours,
      target: employeeData?.contractInfo?.hoursPerWeek || 40
    }));

  const getFirstName = () => {
    if (employeeData?.personalInfo?.firstName) {
      return employeeData.personalInfo.firstName;
    }
    if (user?.displayName) {
      return user.displayName.split(' ')[0];
    }
    return 'Gebruiker';
  };

  const getFullName = () => {
    if (employeeData?.personalInfo?.firstName && employeeData?.personalInfo?.lastName) {
      return `${employeeData.personalInfo.firstName} ${employeeData.personalInfo.lastName}`;
    }
    return user?.displayName || 'Gebruiker';
  };

  const getUserEmail = () => {
    return user?.email || 'geen-email@flg-administratie.nl';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Goedemorgen';
    if (hour < 18) return 'Goedemiddag';
    return 'Goedenavond';
  };

  type Tone = 'bronze' | 'amber' | 'sky' | 'emerald' | 'red' | 'purple';
  const toneClasses: Record<Tone, { iconBg: string; iconText: string }> = {
    bronze:  { iconBg: 'bg-primary-50 dark:bg-primary-900/30',   iconText: 'text-primary-600 dark:text-primary-400' },
    amber:   { iconBg: 'bg-amber-50 dark:bg-amber-900/30',       iconText: 'text-amber-600 dark:text-amber-400' },
    sky:     { iconBg: 'bg-sky-50 dark:bg-sky-900/30',           iconText: 'text-sky-600 dark:text-sky-400' },
    emerald: { iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',   iconText: 'text-emerald-600 dark:text-emerald-400' },
    red:     { iconBg: 'bg-red-50 dark:bg-red-900/30',           iconText: 'text-red-600 dark:text-red-400' },
    purple:  { iconBg: 'bg-purple-50 dark:bg-purple-900/30',     iconText: 'text-purple-600 dark:text-purple-400' },
  };

  const quickActions: Array<{ title: string; subtitle: string; icon: any; href: string; tone: Tone }> = [
    { title: 'Uren',        subtitle: 'Gewerkte uren',     icon: Clock,        href: '/employee-dashboard/timesheets', tone: 'amber' },
    { title: 'Agenda',      subtitle: 'Taken inplannen',   icon: CalendarDays, href: '/employee-dashboard/agenda',     tone: 'sky' },
    { title: 'Declaraties', subtitle: 'Onkosten indienen', icon: Receipt,      href: '/employee-dashboard/expenses',   tone: 'emerald' },
    { title: 'Verlof',      subtitle: 'Aanvragen en saldo', icon: Calendar,     href: '/employee-dashboard/leave',      tone: 'bronze' },
    { title: 'Verzuim',     subtitle: 'Ziek- en betermelden', icon: HeartPulse, href: '/employee-dashboard/absence',    tone: 'red' },
  ];

  const NotificationBanner: React.FC<{
    tone: 'danger' | 'success';
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    items: React.ReactNode;
    actionLabel: string;
    actionHref: string;
  }> = ({ tone, icon: Icon, title, items, actionLabel, actionHref }) => {
    const isDanger = tone === 'danger';
    const c = isDanger
      ? { border: 'border-l-red-500',     iconBg: 'bg-red-50 dark:bg-red-900/30',         iconText: 'text-red-600 dark:text-red-400',         btn: 'bg-red-500 hover:bg-red-600' }
      : { border: 'border-l-emerald-500', iconBg: 'bg-emerald-50 dark:bg-emerald-900/30', iconText: 'text-emerald-600 dark:text-emerald-400', btn: 'bg-emerald-500 hover:bg-emerald-600' };
    return (
      <div className={`bg-white dark:bg-gray-800 border-y border-r border-l-4 ${c.border} border-y-gray-100 border-r-gray-100 dark:border-y-gray-700 dark:border-r-gray-700 rounded-xl shadow-xs p-4 flex items-start gap-3`}>
        <div className={`p-2 rounded-lg ${c.iconBg} flex-shrink-0`}>
          <Icon className={`h-4 w-4 ${c.iconText}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1.5">{title}</h3>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">{items}</div>
        </div>
        <Link
          to={actionHref}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg ${c.btn} text-white text-xs font-semibold transition-colors shadow-xs`}
        >
          {actionLabel}
        </Link>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  const rejectedTimesheets = timesheets.filter(ts => ts.status === 'rejected');
  const approvedRecentTimesheets = timesheets.filter(ts => ts.status === 'approved' && isRecentDate(ts.approvedAt));
  const rejectedLeave = leaveRequests.filter(lr => lr.status === 'rejected');
  const approvedRecentLeave = leaveRequests.filter(lr => lr.status === 'approved' && isRecentDate(lr.approvedAt));

  return (
    <div className="space-y-5">
      {/* Gap-compliance waarschuwing — bovenaan voor maximale zichtbaarheid */}
      <IncompleteWeekBanner targetRoute="/employee-dashboard/timesheets" />

      {/* Hero header */}
      <div className="hidden lg:block relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-6 lg:p-8 text-white shadow-glow-primary-lg">
        <div aria-hidden className="absolute -top-12 -right-12 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div aria-hidden className="absolute -bottom-12 -left-12 w-64 h-64 bg-primary-300/20 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
                {getGreeting()}, {getFirstName()}
              </h1>
              <p className="text-white/80 mt-1.5 text-sm flex items-center gap-2 tracking-tight">
                <Briefcase className="h-4 w-4" />
                {selectedCompany?.name || 'FLG-Administratie'}
              </p>
              {employeeData?.personalInfo?.firstName && (
                <p className="text-white/60 text-xs mt-1">{getFullName()}</p>
              )}
            </div>
            <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl ring-1 ring-white/25">
              <User className="h-6 w-6 text-white" />
            </div>
          </div>

          {/* Quick stats in hero */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Uren deze maand', value: stats.totalHours, icon: Clock },
              { label: 'Kilometers', value: stats.totalKm, icon: TrendingUp },
              { label: 'Goedgekeurd', value: stats.approvedWeeks, icon: CheckCircle },
              { label: 'Contract/week', value: stats.contractHours, icon: Target },
            ].map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="bg-white/12 backdrop-blur-sm rounded-xl p-3.5 ring-1 ring-white/20">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon className="h-3.5 w-3.5 text-white/80" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-white/70">{stat.label}</p>
                  </div>
                  <p className="text-xl font-bold text-white tracking-tight">{stat.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Banners */}
      {rejectedTimesheets.length > 0 && (
        <NotificationBanner
          tone="danger"
          icon={AlertCircle}
          title={rejectedTimesheets.length === 1 ? '1 week afgekeurd — actie vereist' : `${rejectedTimesheets.length} weken afgekeurd — actie vereist`}
          items={rejectedTimesheets.map(ts => (
            <div key={ts.id}>
              <span className="font-semibold text-gray-900 dark:text-gray-100">Week {ts.weekNumber} ({ts.year})</span>
              {ts.rejectionReason && <span className="ml-1.5">— {ts.rejectionReason}</span>}
            </div>
          ))}
          actionLabel="Bekijk en herstel"
          actionHref="/employee-dashboard/timesheets"
        />
      )}

      {approvedRecentTimesheets.length > 0 && (
        <NotificationBanner
          tone="success"
          icon={CheckCircle}
          title={approvedRecentTimesheets.length === 1 ? '1 week goedgekeurd' : `${approvedRecentTimesheets.length} weken goedgekeurd`}
          items={approvedRecentTimesheets.map(ts => (
            <div key={ts.id}><span className="font-semibold text-gray-900 dark:text-gray-100">Week {ts.weekNumber} ({ts.year})</span></div>
          ))}
          actionLabel="Bekijk"
          actionHref="/employee-dashboard/timesheets"
        />
      )}

      {rejectedLeave.length > 0 && (
        <NotificationBanner
          tone="danger"
          icon={AlertCircle}
          title={rejectedLeave.length === 1 ? '1 verlofaanvraag afgekeurd' : `${rejectedLeave.length} verlofaanvragen afgekeurd`}
          items={rejectedLeave.map(lr => (
            <div key={lr.id}>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{lr.leaveType || 'Verlof'}</span>
              {lr.startDate && <span className="ml-1.5">— {new Date(lr.startDate?.toDate ? lr.startDate.toDate() : lr.startDate).toLocaleDateString('nl-NL')}</span>}
              {lr.rejectedReason && <span className="ml-1.5">— {lr.rejectedReason}</span>}
            </div>
          ))}
          actionLabel="Bekijk"
          actionHref="/employee-dashboard/leave"
        />
      )}

      {approvedRecentLeave.length > 0 && (
        <NotificationBanner
          tone="success"
          icon={CheckCircle}
          title={approvedRecentLeave.length === 1 ? '1 verlofaanvraag goedgekeurd' : `${approvedRecentLeave.length} verlofaanvragen goedgekeurd`}
          items={approvedRecentLeave.map(lr => (
            <div key={lr.id}>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{lr.leaveType || 'Verlof'}</span>
              {lr.startDate && <span className="ml-1.5">— {new Date(lr.startDate?.toDate ? lr.startDate.toDate() : lr.startDate).toLocaleDateString('nl-NL')}</span>}
            </div>
          ))}
          actionLabel="Bekijk"
          actionHref="/employee-dashboard/leave"
        />
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2 tracking-tight">
          <Zap className="h-4 w-4 text-amber-500" />
          Snelle acties
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            const c = toneClasses[action.tone];
            return (
              <Link
                key={index}
                to={action.href}
                className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all p-5 flex flex-col items-start gap-3"
              >
                <div className={`w-11 h-11 rounded-xl ${c.iconBg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${c.iconText}`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">{action.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{action.subtitle}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      {hoursChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 tracking-tight">
                <span className="p-1.5 rounded-md bg-primary-50 dark:bg-primary-900/30">
                  <TrendingUp className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
                </span>
                Uren overzicht
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/40 px-2.5 py-1 rounded-md">Deze maand</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={hoursChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="hours" stroke="#cd853f" strokeWidth={2.5} dot={{ fill: '#cd853f', r: 4 }} name="Uren" />
                <Line type="monotone" dataKey="target" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" name="Target" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs p-6">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-5 flex items-center gap-2 tracking-tight">
              <span className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-900/30">
                <Award className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </span>
              Overzicht
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">Totale uren</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mt-0.5 tabular-nums">{stats.totalHours}<span className="text-gray-400 dark:text-gray-500 font-normal text-base ml-0.5">u</span></p>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">Reiskilometers</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mt-0.5 tabular-nums">{stats.totalKm}<span className="text-gray-400 dark:text-gray-500 font-normal text-base ml-0.5">km</span></p>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">Weken ingediend</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mt-0.5 tabular-nums">{timesheets.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2 tracking-tight">
          <Target className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          Huidige status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { title: 'Bedrijf',           description: selectedCompany?.name || 'Geen bedrijf',                                                                       icon: Building2,    tone: 'bronze' as Tone },
            { title: 'Contract uren',     description: `${employeeData?.contractInfo?.hoursPerWeek || 40}u per week`,                                                  icon: Clock,        tone: 'purple' as Tone },
            { title: 'Ingediende weken',  description: `${timesheets.filter(t => t.status === 'submitted' || t.status === 'approved').length} weken`,                  icon: CheckCircle,  tone: 'emerald' as Tone },
            { title: 'Status',            description: 'Alles is up-to-date',                                                                                          icon: ListChecks,   tone: 'sky' as Tone },
          ].map((item, index) => {
            const Icon = item.icon;
            const c = toneClasses[item.tone];
            return (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xs p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${c.iconText}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500">{item.title}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5 tracking-tight truncate">{item.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;