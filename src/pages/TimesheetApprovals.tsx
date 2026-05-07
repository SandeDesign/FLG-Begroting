import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Check, X, Clock, ChevronDown, AlertCircle, CheckCircle, User, Calendar, MapPin, Filter, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { WeeklyTimesheet } from '../types/timesheet';
import {
  getAllPendingTimesheets,
  approveWeeklyTimesheet,
  rejectWeeklyTimesheet,
  updateWeeklyTimesheet
} from '../services/timesheetService';
import { AuditService } from '../services/auditService';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { usePageTitle } from '../contexts/PageTitleContext';
import { isWeekInQuarter } from '../utils/dateFilters';

interface EmployeeTimesheetSummary {
  employeeId: string;
  firstName: string;
  lastName: string;
  contractHoursPerWeek: number;
  pendingTimesheets: WeeklyTimesheet[];
  allTimesheets: WeeklyTimesheet[];
  hasPending: boolean;
  totalPendingHours?: number;
  hoursLacking?: number;
  totalAllHours?: number;
}

function formatFirebaseDate(dateVal: any, options?: Intl.DateTimeFormatOptions): string {
  const opts = options || {};
  if (typeof dateVal === 'string') return new Date(dateVal).toLocaleDateString('nl-NL', opts);
  if (dateVal instanceof Date) return dateVal.toLocaleDateString('nl-NL', opts);
  if (typeof dateVal?.toDate === 'function') return dateVal.toDate().toLocaleDateString('nl-NL', opts);
  return 'onbekende datum';
}

export default function TimesheetApprovals() {
  const { user, adminUserId, userRole, currentEmployeeId } = useAuth();
  const { selectedCompany, employees, selectedYear, selectedQuarter } = useApp();
  const { success, error: showError } = useToast();
  usePageTitle('Uren goedkeuren');

  const [loading, setLoading] = useState(true);
  const [employeeSummaries, setEmployeeSummaries] = useState<EmployeeTimesheetSummary[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [expandedWeekId, setExpandedWeekId] = useState<string | null>(null);
  const [rejectingWeekId, setRejectingWeekId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const pillBarRef = useRef<HTMLDivElement>(null);

  const loadAllTimesheets = useCallback(async (userId: string, companyId: string) => {
    try {
      const q = query(
        collection(db, 'weeklyTimesheets'),
        where('userId', '==', userId),
        where('companyId', '==', companyId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          entries: (data.entries || []).map((entry: any) => ({
            ...entry,
            date: entry.date instanceof Timestamp ? entry.date.toDate() : new Date(entry.date)
          })),
          submittedAt: data.submittedAt instanceof Timestamp ? data.submittedAt.toDate() : data.submittedAt,
          approvedAt: data.approvedAt instanceof Timestamp ? data.approvedAt.toDate() : data.approvedAt,
          rejectedAt: data.rejectedAt instanceof Timestamp ? data.rejectedAt.toDate() : data.rejectedAt,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt
        } as WeeklyTimesheet;
      });
    } catch (error) {
      console.error('Error loading all timesheets:', error);
      return [];
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!user || !adminUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      let pendingTimesheets = await getAllPendingTimesheets(adminUserId);
      const companyIdForAll = selectedCompany?.id || '';
      let allTimesheetsData = companyIdForAll ? await loadAllTimesheets(adminUserId, companyIdForAll) : [];

      // Manager mag z'n eigen uren NIET zelf goedkeuren — admin/co-admin
      // doet dat. Filter ze eruit zodat manager ze niet ziet (en dus ook
      // niet per ongeluk kan approven). Admin/co-admin ziet ze wel.
      if (userRole === 'manager' && currentEmployeeId) {
        pendingTimesheets = pendingTimesheets.filter((t) => t.employeeId !== currentEmployeeId);
        allTimesheetsData = allTimesheetsData.filter((t) => t.employeeId !== currentEmployeeId);
      }

      const summaries: EmployeeTimesheetSummary[] = [];

      employees.forEach(employee => {
        const employeePendingTimesheets = pendingTimesheets.filter(t => t.employeeId === employee.id);
        const employeeAllTimesheets = allTimesheetsData.filter(t => t.employeeId === employee.id);

        const totalPendingHours = employeePendingTimesheets.reduce((sum, t) => sum + t.totalRegularHours, 0);
        const contractHours = employee.contractInfo?.hoursPerWeek || 40;
        const expectedHours = contractHours * employeePendingTimesheets.length;
        const hoursLacking = Math.max(0, expectedHours - totalPendingHours);
        const totalAllHours = employeeAllTimesheets.reduce((sum, t) => sum + t.totalRegularHours, 0);

        summaries.push({
          employeeId: employee.id,
          firstName: employee.personalInfo.firstName,
          lastName: employee.personalInfo.lastName,
          contractHoursPerWeek: contractHours,
          pendingTimesheets: employeePendingTimesheets,
          allTimesheets: employeeAllTimesheets,
          hasPending: employeePendingTimesheets.length > 0,
          totalPendingHours,
          hoursLacking,
          totalAllHours
        });
      });

      const sorted = summaries.sort((a, b) => {
        if (a.hasPending && !b.hasPending) return -1;
        if (!a.hasPending && b.hasPending) return 1;
        return a.firstName.localeCompare(b.firstName);
      });

      setEmployeeSummaries(sorted);

      // Auto-select first employee with pending, or first employee
      if (!selectedEmployeeId || !sorted.find(s => s.employeeId === selectedEmployeeId)) {
        const firstWithPending = sorted.find(s => s.hasPending);
        const autoId = firstWithPending?.employeeId || sorted[0]?.employeeId || null;
        if (autoId) {
          setSelectedEmployeeId(autoId);
          const emp = sorted.find(s => s.employeeId === autoId);
          setActiveTab(emp?.hasPending ? 'pending' : 'all');
          setExpandedWeekId(emp?.pendingTimesheets[0]?.id || null);
        }
      }
    } catch (error) {
      console.error('Error loading timesheet approvals:', error);
      showError('Fout bij laden', 'Kon urenregistratie goedkeuringen niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, adminUserId, selectedCompany?.id, employees, showError, loadAllTimesheets, selectedEmployeeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectEmployee = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    const emp = employeeSummaries.find(s => s.employeeId === employeeId);
    setActiveTab(emp?.hasPending ? 'pending' : 'all');
    setExpandedWeekId(emp?.pendingTimesheets[0]?.id || null);
    setRejectingWeekId(null);
    setRejectionReason('');
  };

  const handleApprove = async (timesheet: WeeklyTimesheet) => {
    if (!user || !adminUserId) return;
    try {
      await approveWeeklyTimesheet(timesheet.id!, timesheet.userId, adminUserId);
      success('Uren goedgekeurd', `Week ${timesheet.weekNumber} goedgekeurd`);
      setExpandedWeekId(null);
      await loadData();
    } catch (error) {
      console.error('Error approving timesheet:', error);
      showError('Fout bij goedkeuren', 'Kon urenregistratie niet goedkeuren');
    }
  };

  const handleRejectConfirm = async (timesheet: WeeklyTimesheet) => {
    if (!user || !adminUserId || !rejectionReason.trim()) {
      showError('Fout', 'Reden voor afwijzing is verplicht.');
      return;
    }
    try {
      await rejectWeeklyTimesheet(timesheet.id!, timesheet.userId, adminUserId, rejectionReason);
      success('Uren afgekeurd', `Week ${timesheet.weekNumber} afgekeurd`);
      setRejectingWeekId(null);
      setRejectionReason('');
      setExpandedWeekId(null);
      await loadData();
    } catch (error) {
      console.error('Error rejecting timesheet:', error);
      showError('Fout bij afwijzen', 'Kon urenregistratie niet afwijzen');
    }
  };

  const handleReopenTimesheet = async (timesheet: WeeklyTimesheet) => {
    if (!user || !adminUserId) return;
    const confirmed = window.confirm(
      `Week ${timesheet.weekNumber} (${timesheet.year}) heropenen?\n\nAlle ingevulde uren worden gewist en de medewerker kan opnieuw beginnen. Dit wordt gelogd in het audit log.`
    );
    if (!confirmed) return;
    try {
      const emptyEntries = timesheet.entries.map(e => ({
        ...e,
        regularHours: 0,
        overtimeHours: 0,
        eveningHours: 0,
        nightHours: 0,
        weekendHours: 0,
        travelKilometers: 0,
        dayStatus: undefined,
        statusReason: undefined,
        effortNote: undefined,
        notes: undefined,
        workActivities: [],
        updatedAt: new Date(),
      }));
      await updateWeeklyTimesheet(timesheet.id!, timesheet.userId, {
        entries: emptyEntries,
        status: 'draft',
        totalRegularHours: 0,
        totalOvertimeHours: 0,
        totalEveningHours: 0,
        totalNightHours: 0,
        totalWeekendHours: 0,
        totalTravelKilometers: 0,
        submittedAt: undefined,
        submittedBy: undefined,
        approvedAt: undefined,
        approvedBy: undefined,
        rejectedAt: undefined,
        rejectedBy: undefined,
        rejectionReason: undefined,
        lockedAt: undefined,
        lowHoursReview: undefined,
      });
      await AuditService.logAction(
        adminUserId,
        'update' as any,
        'time_entry' as any,
        timesheet.id!,
        {
          companyId: timesheet.companyId,
          severity: 'warning' as any,
          metadata: {
            reason: 'timesheet_reopened_by_admin',
            previousStatus: timesheet.status,
            employeeId: timesheet.employeeId,
            weekNumber: timesheet.weekNumber,
            year: timesheet.year,
          },
          performedBy: {
            uid: user.uid,
            email: user.email || 'unknown',
            role: (userRole as any) || 'admin',
          },
        }
      );
      success('Week heropend', `Week ${timesheet.weekNumber} is geleegd en staat opnieuw op concept.`);
      await loadData();
    } catch (error) {
      console.error('Error reopening timesheet:', error);
      showError('Fout bij heropenen', 'Kon week niet heropenen');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const pendingCount = employeeSummaries.reduce((sum, e) => sum + e.pendingTimesheets.length, 0);
  const selectedEmployee = employeeSummaries.find(s => s.employeeId === selectedEmployeeId);

  // Filter "Alle weken" by year/quarter from header + local status filter
  const getFilteredAllWeeks = (timesheets: WeeklyTimesheet[]) => {
    return timesheets
      .filter(t => t.year === selectedYear)
      .filter(t => isWeekInQuarter(t.weekNumber, selectedQuarter))
      .filter(t => statusFilter === 'all' || t.status === statusFilter)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.weekNumber - a.weekNumber;
      });
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0 pb-24 sm:pb-6">
      {/* Header */}
      <div className="hidden lg:block">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Uren goedkeuren</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
          {pendingCount} aanvraag{pendingCount !== 1 ? 'en' : ''} wachtend op goedkeuring
        </p>
      </div>

      {employeeSummaries.length === 0 ? (
        <Card>
          <EmptyState
            icon={Clock}
            title="Geen medewerkers"
            description="Er zijn geen medewerkers in uw bedrijf."
          />
        </Card>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* ===== MOBILE: Horizontal pill bar ===== */}
          <div className="lg:hidden">
            <div
              ref={pillBarRef}
              className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {employeeSummaries.map((emp) => {
                const isSelected = emp.employeeId === selectedEmployeeId;
                return (
                  <button
                    key={emp.employeeId}
                    onClick={() => selectEmployee(emp.employeeId)}
                    className={`flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                      isSelected
                        ? emp.hasPending
                          ? 'bg-orange-600 text-white shadow-md'
                          : 'bg-primary-600 text-white shadow-md'
                        : emp.hasPending
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {emp.firstName}
                    {emp.hasPending ? (
                      <span className={`ml-1.5 inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold ${
                        isSelected ? 'bg-white/30 text-white' : 'bg-orange-200 text-orange-800'
                      }`}>
                        {emp.pendingTimesheets.length}
                      </span>
                    ) : (
                      <CheckCircle className={`ml-1.5 h-4 w-4 inline ${isSelected ? 'text-white/80' : 'text-green-500'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===== DESKTOP: Sidebar ===== */}
          <div className="hidden lg:block w-72 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Medewerkers</h3>
              </div>
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                {employeeSummaries.map((emp) => {
                  const isSelected = emp.employeeId === selectedEmployeeId;
                  return (
                    <button
                      key={emp.employeeId}
                      onClick={() => selectEmployee(emp.employeeId)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                        isSelected
                          ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-500'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        emp.hasPending
                          ? 'bg-orange-100 dark:bg-orange-900/30'
                          : 'bg-green-100 dark:bg-green-900/30'
                      }`}>
                        <User className={`h-4 w-4 ${emp.hasPending ? 'text-orange-600' : 'text-green-600'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${
                          isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {emp.firstName} {emp.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">
                          {emp.hasPending ? (
                            <span className="text-orange-600 dark:text-orange-400 font-medium">
                              {emp.pendingTimesheets.length} wachtend
                            </span>
                          ) : (
                            <span className="text-green-600 dark:text-green-400">{emp.allTimesheets.length} weken</span>
                          )}
                          <span className="mx-1">·</span>
                          {emp.contractHoursPerWeek}u/week
                        </p>
                      </div>
                      {emp.hasPending && (
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-orange-500 text-white text-xs font-bold flex-shrink-0">
                          {emp.pendingTimesheets.length}
                        </span>
                      )}
                      {!emp.hasPending && (
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ===== DETAIL PANEL ===== */}
          <div className="flex-1 min-w-0">
            {selectedEmployee ? (
              <div className="space-y-4">
                {/* Employee Header */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-800 dark:to-primary-700 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-primary-600 dark:text-primary-300" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {selectedEmployee.firstName} {selectedEmployee.lastName}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-300">
                        Contract: {selectedEmployee.contractHoursPerWeek}u/week
                      </p>
                    </div>
                  </div>
                  {/* Mini stats */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-300">Weken</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedEmployee.allTimesheets.length}</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-300">Totaal</p>
                      <p className="text-lg font-bold text-green-600">{selectedEmployee.totalAllHours || 0}u</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-300">Wachten</p>
                      <p className="text-lg font-bold text-orange-600">{selectedEmployee.pendingTimesheets.length}</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-300">Gem/week</p>
                      <p className="text-lg font-bold text-primary-600">
                        {selectedEmployee.allTimesheets.length > 0
                          ? ((selectedEmployee.totalAllHours || 0) / selectedEmployee.allTimesheets.length).toFixed(1)
                          : '0'}u
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tab Bar */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="flex border-b border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setActiveTab('pending')}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${
                        activeTab === 'pending'
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      Wachten op goedkeuring
                      {selectedEmployee.pendingTimesheets.length > 0 && (
                        <span className={`ml-1.5 inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 rounded-full text-xs font-bold ${
                          activeTab === 'pending'
                            ? 'bg-orange-500 text-white'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                        }`}>
                          {selectedEmployee.pendingTimesheets.length}
                        </span>
                      )}
                      {activeTab === 'pending' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab('all')}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition-all relative ${
                        activeTab === 'all'
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      Alle weken
                      <span className={`ml-1.5 text-xs ${
                        activeTab === 'all' ? 'text-primary-500' : 'text-gray-400'
                      }`}>
                        ({getFilteredAllWeeks(selectedEmployee.allTimesheets).length})
                      </span>
                      {activeTab === 'all' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
                      )}
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="p-4">
                    {/* ===== PENDING TAB ===== */}
                    {activeTab === 'pending' && (
                      <div className="space-y-3">
                        {selectedEmployee.pendingTimesheets.length === 0 ? (
                          <div className="text-center py-8">
                            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-200">
                              Geen wachtende uren
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              Alle uren van {selectedEmployee.firstName} zijn goedgekeurd
                            </p>
                          </div>
                        ) : (
                          selectedEmployee.pendingTimesheets.map((timesheet) => {
                            const isExpanded = expandedWeekId === timesheet.id;
                            const isRejecting = rejectingWeekId === timesheet.id;
                            const hoursPercentage = (timesheet.totalRegularHours / selectedEmployee.contractHoursPerWeek) * 100;
                            const isUnder = hoursPercentage < 85;
                            const workDays = timesheet.entries.filter(e => e.regularHours > 0).length;
                            const avgPerDay = workDays > 0 ? (timesheet.totalRegularHours / workDays).toFixed(1) : '0';

                            return (
                              <div key={timesheet.id} className="border-2 border-orange-200 dark:border-orange-800 rounded-lg overflow-hidden">
                                {/* Collapsed header - always visible */}
                                <button
                                  onClick={() => {
                                    setExpandedWeekId(isExpanded ? null : timesheet.id!);
                                    setRejectingWeekId(null);
                                    setRejectionReason('');
                                  }}
                                  className="w-full p-3 sm:p-4 flex items-center gap-3 text-left hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors"
                                >
                                  <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                                        Week {timesheet.weekNumber}, {timesheet.year}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                                        Wachten
                                      </span>
                                    </div>
                                    {timesheet.submittedAt && (
                                      <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">
                                        Ingediend: {formatFirebaseDate(timesheet.submittedAt)}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`text-lg font-bold ${isUnder ? 'text-red-600' : 'text-green-600'}`}>
                                      {timesheet.totalRegularHours}u
                                    </span>
                                    {isUnder && <AlertCircle className="h-4 w-4 text-red-500" />}
                                  </div>
                                </button>

                                {/* Progress bar - always visible */}
                                <div className="px-4 pb-2">
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-1.5 rounded-full transition-all ${isUnder ? 'bg-red-500' : 'bg-green-500'}`}
                                      style={{ width: `${Math.min(hoursPercentage, 100)}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Expanded content */}
                                {isExpanded && (
                                  <div className="border-t border-orange-200 dark:border-orange-800 p-4 space-y-4 bg-white dark:bg-gray-800">
                                    {/* Summary Stats */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      <div className="text-center p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                        <p className="text-xs text-gray-500 dark:text-gray-300">Totaal uren</p>
                                        <p className={`text-xl font-bold ${isUnder ? 'text-red-600' : 'text-green-600'}`}>
                                          {timesheet.totalRegularHours}u
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">{hoursPercentage.toFixed(0)}% van {selectedEmployee.contractHoursPerWeek}u</p>
                                      </div>
                                      <div className="text-center p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                        <p className="text-xs text-gray-500 dark:text-gray-300">Reiskilometers</p>
                                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{timesheet.totalTravelKilometers}km</p>
                                      </div>
                                      <div className="text-center p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                        <p className="text-xs text-gray-500 dark:text-gray-300">Werkdagen</p>
                                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{workDays}</p>
                                      </div>
                                      <div className="text-center p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                        <p className="text-xs text-gray-500 dark:text-gray-300">Gem/dag</p>
                                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{avgPerDay}u</p>
                                      </div>
                                    </div>

                                    {/* Low Hours Warning */}
                                    {isUnder && (
                                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                        <div className="flex gap-2">
                                          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                          <div>
                                            <p className="text-sm font-semibold text-red-900 dark:text-red-300">Onder contract uren</p>
                                            <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                                              {timesheet.totalRegularHours}u van {selectedEmployee.contractHoursPerWeek}u ({hoursPercentage.toFixed(0)}%)
                                            </p>
                                            {(timesheet as any).lowHoursExplanation && (
                                              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 italic">
                                                Verklaring: {(timesheet as any).lowHoursExplanation}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Low Hours Review Antwoorden */}
                                    {timesheet.lowHoursReview && (
                                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3">
                                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                          Antwoorden medewerker (weinig uren)
                                          <span className="ml-auto font-normal text-amber-700 dark:text-amber-400">
                                            {timesheet.lowHoursReview.actualWeeklyHours}u ingevuld
                                          </span>
                                        </p>
                                        <div className="space-y-2">
                                          <div>
                                            <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">1. Is er dagelijks contact geweest met kantoor?</p>
                                            <p className="text-xs text-amber-900 dark:text-amber-200 mt-0.5 whitespace-pre-wrap">{timesheet.lowHoursReview.dailyContact}</p>
                                          </div>
                                          <div>
                                            <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">2. Heb jij zelf alle effort erin gestoken om effectief te zijn?</p>
                                            <p className="text-xs text-amber-900 dark:text-amber-200 mt-0.5 whitespace-pre-wrap">{timesheet.lowHoursReview.effortInvested}</p>
                                          </div>
                                          <div>
                                            <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">3. Welke suggesties heb je om tijd effectiever te maken?</p>
                                            <p className="text-xs text-amber-900 dark:text-amber-200 mt-0.5 whitespace-pre-wrap">{timesheet.lowHoursReview.suggestions}</p>
                                          </div>
                                          {timesheet.lowHoursReview.suggestionsSelf && (
                                            <div>
                                              <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">3b. Wat kun jij of het team zelf doen?</p>
                                              <p className="text-xs text-amber-900 dark:text-amber-200 mt-0.5 whitespace-pre-wrap">{timesheet.lowHoursReview.suggestionsSelf}</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Daily Details */}
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                                        <Calendar className="h-4 w-4" />
                                        Dagelijkse details
                                      </h4>
                                      <div className="space-y-1.5">
                                        {timesheet.entries.map((entry, idx) => (
                                          <div key={idx} className={`p-2.5 rounded-lg border ${
                                            entry.regularHours > 0
                                              ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                                              : 'bg-gray-50/50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800'
                                          }`}>
                                            <div className="flex justify-between items-baseline">
                                              <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                                {formatFirebaseDate(entry.date, { weekday: 'short', day: '2-digit', month: 'short' })}
                                              </span>
                                              <span className={`text-sm font-bold ${entry.regularHours > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                                                {entry.regularHours}u
                                              </span>
                                            </div>
                                            {entry.travelKilometers > 0 && (
                                              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-300">
                                                <MapPin className="h-3 w-3" />
                                                {entry.travelKilometers}km
                                              </div>
                                            )}
                                            {(entry as any).workActivities && (entry as any).workActivities.length > 0 && (
                                              <div className="space-y-1 mt-1.5 pl-3 border-l-2 border-gray-300 dark:border-gray-600">
                                                {(entry as any).workActivities.map((activity: any, actIdx: number) => (
                                                  <div key={actIdx} className="flex justify-between items-start text-xs text-gray-600 dark:text-gray-300">
                                                    <span className="flex items-center gap-1 flex-wrap mr-2">
                                                      {activity.internalProjectName && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium">
                                                          {activity.internalProjectName}
                                                        </span>
                                                      )}
                                                      <span className="truncate">{activity.description}</span>
                                                    </span>
                                                    <span className="font-semibold flex-shrink-0">{activity.hours}u</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Action Buttons */}
                                    {!isRejecting && (
                                      <div className="flex gap-3 pt-2">
                                        <Button
                                          onClick={() => handleApprove(timesheet)}
                                          variant="success"
                                          className="flex-1"
                                          size="lg"
                                        >
                                          <Check className="h-4 w-4 mr-2" />
                                          Goedkeuren
                                        </Button>
                                        <Button
                                          onClick={() => setRejectingWeekId(timesheet.id!)}
                                          variant="danger"
                                          className="flex-1"
                                          size="lg"
                                        >
                                          <X className="h-4 w-4 mr-2" />
                                          Afkeuren
                                        </Button>
                                      </div>
                                    )}

                                    {/* Inline Rejection Form */}
                                    {isRejecting && (
                                      <div className="space-y-3 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
                                        <h4 className="font-semibold text-red-900 dark:text-red-300">Reden voor afkeuring</h4>
                                        <textarea
                                          value={rejectionReason}
                                          onChange={(e) => setRejectionReason(e.target.value)}
                                          className="w-full px-3 py-2 border-2 border-red-300 dark:border-red-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                          rows={3}
                                          placeholder="Bijvoorbeeld: Ongeldige uren op donderdag..."
                                          autoFocus
                                        />
                                        <div className="flex gap-3">
                                          <Button
                                            onClick={() => {
                                              setRejectingWeekId(null);
                                              setRejectionReason('');
                                            }}
                                            variant="secondary"
                                            className="flex-1"
                                          >
                                            Annuleren
                                          </Button>
                                          <Button
                                            onClick={() => handleRejectConfirm(timesheet)}
                                            disabled={!rejectionReason.trim()}
                                            variant="danger"
                                            className="flex-1"
                                          >
                                            Bevestigen
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* ===== ALL WEEKS TAB ===== */}
                    {activeTab === 'all' && (() => {
                      const filteredWeeks = getFilteredAllWeeks(selectedEmployee.allTimesheets);
                      const totalFilteredHours = filteredWeeks.reduce((sum, t) => sum + t.totalRegularHours, 0);

                      return (
                      <div className="space-y-3">
                        {/* Filter bar */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-300">
                            <Filter className="h-3.5 w-3.5" />
                            <span className="font-medium">Filter:</span>
                          </div>
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          >
                            <option value="all">Alle statussen</option>
                            <option value="submitted">Wachten</option>
                            <option value="approved">Goedgekeurd</option>
                            <option value="rejected">Afgekeurd</option>
                            <option value="processed">Verwerkt</option>
                            <option value="draft">Concept</option>
                          </select>
                          <div className="flex-1" />
                          <span className="text-xs text-gray-500 dark:text-gray-300">
                            {filteredWeeks.length} week{filteredWeeks.length !== 1 ? 'en' : ''} · {totalFilteredHours}u
                          </span>
                        </div>

                        {/* Hint: year/quarter is controlled by the header */}
                        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Periode: {selectedYear} {selectedQuarter ? `Q${selectedQuarter}` : 'heel jaar'} — wijzig via de header
                        </p>

                        {filteredWeeks.length === 0 ? (
                          <div className="text-center py-8">
                            <Calendar className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-200">
                              Geen weken gevonden
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              Pas de periode of status filter aan
                            </p>
                          </div>
                        ) : (
                          filteredWeeks.map((timesheet) => {
                              const percentage = (timesheet.totalRegularHours / selectedEmployee.contractHoursPerWeek) * 100;
                              const isPending = selectedEmployee.pendingTimesheets.some(t => t.id === timesheet.id);

                              return (
                                <div
                                  key={timesheet.id}
                                  onClick={() => {
                                    if (isPending) {
                                      setActiveTab('pending');
                                      setExpandedWeekId(timesheet.id!);
                                    }
                                  }}
                                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                                    isPending
                                      ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/20 cursor-pointer'
                                      : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 cursor-default'
                                  }`}
                                >
                                  <div className="flex justify-between items-center mb-1.5">
                                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                      Week {timesheet.weekNumber}, {timesheet.year}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold text-sm ${percentage < 85 ? 'text-red-600' : 'text-green-600'}`}>
                                        {timesheet.totalRegularHours}u
                                      </span>
                                      {timesheet.status === 'approved' && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-semibold flex items-center gap-1">
                                          <CheckCircle className="h-3 w-3" />
                                          Goedgekeurd
                                        </span>
                                      )}
                                      {isPending && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 font-semibold">
                                          Wachten
                                        </span>
                                      )}
                                      {timesheet.status === 'rejected' && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-semibold">
                                          Afgekeurd
                                        </span>
                                      )}
                                      {timesheet.status === 'processed' && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-semibold">
                                          Verwerkt
                                        </span>
                                      )}
                                      {timesheet.status === 'draft' && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold">
                                          Concept
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-1.5 rounded-full ${percentage < 85 ? 'bg-red-500' : 'bg-green-500'}`}
                                      style={{ width: `${Math.min(percentage, 100)}%` }}
                                    />
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-300 mt-1.5 flex justify-between">
                                    <span>{percentage.toFixed(0)}% van contract ({selectedEmployee.contractHoursPerWeek}u)</span>
                                    <span>{timesheet.totalTravelKilometers}km</span>
                                  </div>
                                  {(timesheet as any).lowHoursExplanation && (
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 italic">
                                      Verklaring: {(timesheet as any).lowHoursExplanation}
                                    </p>
                                  )}
                                  {timesheet.lowHoursReview && (
                                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-[11px] space-y-1.5">
                                      <p className="font-semibold text-amber-800 dark:text-amber-300">Antwoorden medewerker ({timesheet.lowHoursReview.actualWeeklyHours}u)</p>
                                      <div>
                                        <span className="font-medium text-amber-700 dark:text-amber-400">Dagelijks contact: </span>
                                        <span className="text-amber-900 dark:text-amber-200">{timesheet.lowHoursReview.dailyContact}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-amber-700 dark:text-amber-400">Eigen inzet: </span>
                                        <span className="text-amber-900 dark:text-amber-200">{timesheet.lowHoursReview.effortInvested}</span>
                                      </div>
                                      <div>
                                        <span className="font-medium text-amber-700 dark:text-amber-400">Suggesties: </span>
                                        <span className="text-amber-900 dark:text-amber-200">{timesheet.lowHoursReview.suggestions}</span>
                                      </div>
                                      {timesheet.lowHoursReview.suggestionsSelf && (
                                        <div>
                                          <span className="font-medium text-amber-700 dark:text-amber-400">Eigen actie: </span>
                                          <span className="text-amber-900 dark:text-amber-200">{timesheet.lowHoursReview.suggestionsSelf}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {timesheet.approvedAt && (
                                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                                      Goedgekeurd op {formatFirebaseDate(timesheet.approvedAt)}
                                    </p>
                                  )}
                                  {timesheet.rejectedAt && (
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-medium">
                                      Afgekeurd op {formatFirebaseDate(timesheet.rejectedAt)}
                                      {timesheet.rejectionReason && (
                                        <span className="italic"> — {timesheet.rejectionReason}</span>
                                      )}
                                    </p>
                                  )}
                                  {(userRole === 'admin' || userRole === 'co-admin' || userRole === 'manager') && timesheet.status !== 'draft' && (
                                    <div className="mt-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={() => handleReopenTimesheet(timesheet)}
                                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                        Heropenen
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                        )}
                      </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <Card>
                <EmptyState
                  icon={User}
                  title="Selecteer een medewerker"
                  description="Kies een medewerker aan de linkerzijde om de uren te bekijken."
                />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
