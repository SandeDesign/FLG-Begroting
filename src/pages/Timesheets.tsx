import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Save, Send, Download, ChevronLeft, ChevronRight, User, Palmtree, HeartPulse, FolderKanban, ListChecks, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { WeeklyTimesheet, TimesheetEntry, WorkActivity } from '../types/timesheet';
import { LeaveRequest, SickLeave, BusinessTask } from '../types';
import { InternalProject } from '../types/internalProject';
import { getInternalProjects } from '../services/internalProjectService';
import { getProjectColorMeta } from './InternalProjects';
import {
  getWeeklyTimesheets,
  createWeeklyTimesheet,
  updateWeeklyTimesheet,
  submitWeeklyTimesheet,
  getWeekNumber,
  getISOWeekYear,
  getWeekDates,
  calculateWeekTotals
} from '../services/timesheetService';
import { getEmployeeById, getLeaveRequests, getSickLeaveRecords, getTasksAssignedToUser } from '../services/firebase';
import { getEmployeeVehicle, updateVehicleMileage, saveVehicleDayLogs } from '../services/vehicleService';
import { Vehicle } from '../types/vehicle';
import { useToast } from '../hooks/useToast';
import { EmptyState } from '../components/ui/EmptyState';
import { usePageTitle } from '../contexts/PageTitleContext';
import { containsOpdrachtgeverBlame } from '../utils/timesheetCompliance';
import { isPublicHoliday } from '../utils/leaveCalculations';
import { AuditService } from '../services/auditService';

/**
 * Ketent de kilometerstanden door: de beginstand van dag N = eindstand van de
 * vorige dag met een ingevulde eindstand, en de allereerste beginstand komt van
 * de auto (currentMileage). Alleen de eindstand wordt door de medewerker
 * ingevuld; de beginstand én dagkilometers worden hieruit afgeleid.
 */
function recalcKmChain(entries: TimesheetEntry[], baseMileage: number): TimesheetEntry[] {
  const out = entries.map(e => ({ ...e }));
  const order = out
    .map((_, i) => i)
    .sort((a, b) => new Date(out[a].date).getTime() - new Date(out[b].date).getTime());
  let last = baseMileage;
  for (const i of order) {
    out[i].startKilometers = last;
    const end = out[i].endKilometers;
    if (typeof end === 'number' && end >= last) {
      out[i].travelKilometers = end - last;
      last = end;
    } else {
      out[i].travelKilometers = 0;
    }
  }
  return out;
}

export default function Timesheets() {
  const { user, userRole } = useAuth();
  const { currentEmployeeId, selectedCompany, employees, queryUserId } = useApp(); // ✅ Gebruik queryUserId
  const { success, error: showError } = useToast();
  usePageTitle('Urenregistratie');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [timesheets, setTimesheets] = useState<WeeklyTimesheet[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number>(getWeekNumber(new Date()));
  const [selectedYear, setSelectedYear] = useState<number>(getISOWeekYear(new Date())); // ✅ FIX: Use ISO week year instead of calendar year
  const [currentTimesheet, setCurrentTimesheet] = useState<WeeklyTimesheet | null>(null);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  // Verlof & Ziekte state
  const [weekLeaveRequests, setWeekLeaveRequests] = useState<LeaveRequest[]>([]);
  const [weekSickLeaves, setWeekSickLeaves] = useState<SickLeave[]>([]);
  // Low-hours review modal state
  const [showLowHoursModal, setShowLowHoursModal] = useState(false);
  const [reviewAnswers, setReviewAnswers] = useState({
    dailyContact: '',
    effortInvested: '',
    suggestions: '',
    suggestionsSelf: '',
  });
  // Interne projecten
  const [internalProjects, setInternalProjects] = useState<InternalProject[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<BusinessTask[]>([]);
  // Aan de medewerker gekoppelde auto (Auto-beheer) — voor KM-standen
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !queryUserId || !selectedCompany) {
      setLoading(false);
      return;
    }

    // Voor admin/co-admin/manager: selecteerbare employee, voor employee: eigen currentEmployeeId
    const effectiveEmployeeId = (userRole === 'admin' || userRole === 'co-admin' || userRole === 'manager') ? (selectedEmployeeId || currentEmployeeId) : currentEmployeeId;

    if (!effectiveEmployeeId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const employee = await getEmployeeById(effectiveEmployeeId);
      if (!employee) {
        showError('Fout', 'Werknemergegevens niet gevonden.');
        setLoading(false);
        return;
      }
      setEmployeeData(employee);

      // Gekoppelde auto ophalen (voor KM-standen koppeling)
      try {
        const vehicle = await getEmployeeVehicle(queryUserId, selectedCompany.id, effectiveEmployeeId);
        setAssignedVehicle(vehicle);
      } catch {
        setAssignedVehicle(null);
      }

      const sheets = await getWeeklyTimesheets(
        queryUserId,
        effectiveEmployeeId,
        selectedYear,
        selectedWeek
      );

      setTimesheets(sheets);

      // Haal verlof en ziekte data op voor deze werknemer
      const weekDates = getWeekDates(selectedYear, selectedWeek);
      const weekStart = weekDates[0];
      const weekEnd = weekDates[6];

      // Verlofaanvragen ophalen en filteren op deze week
      const allLeaveRequests = await getLeaveRequests(queryUserId, effectiveEmployeeId);
      const weekLeave = allLeaveRequests.filter(leave => {
        if (leave.status !== 'approved') return false;
        const leaveStart = leave.startDate instanceof Date ? leave.startDate : new Date(leave.startDate);
        const leaveEnd = leave.endDate instanceof Date ? leave.endDate : new Date(leave.endDate);
        // Check of verlof overlapt met de geselecteerde week
        return leaveStart <= weekEnd && leaveEnd >= weekStart;
      });
      setWeekLeaveRequests(weekLeave);

      // Ziekmeldingen ophalen en filteren op deze week
      const allSickLeaves = await getSickLeaveRecords(queryUserId, effectiveEmployeeId);
      const weekSick = allSickLeaves.filter(sick => {
        if (sick.status === 'recovered') {
          // Check of hersteld binnen de week
          const recoveryDate = sick.actualReturnDate || sick.endDate;
          if (!recoveryDate) return false;
          const recovery = recoveryDate instanceof Date ? recoveryDate : new Date(recoveryDate);
          return recovery >= weekStart;
        }
        // Actieve ziekmelding die begon voor of in deze week
        const sickStart = sick.startDate instanceof Date ? sick.startDate : new Date(sick.startDate);
        const sickEnd = sick.endDate ? (sick.endDate instanceof Date ? sick.endDate : new Date(sick.endDate)) : weekEnd;
        return sickStart <= weekEnd && sickEnd >= weekStart;
      });
      setWeekSickLeaves(weekSick);

      // Interne projecten laden
      const projects = await getInternalProjects(queryUserId, selectedCompany.id);
      setInternalProjects(projects);

      // Taken laden voor de huidige medewerker (voor taakselectie bij werkactiviteiten)
      const tasks = await getTasksAssignedToUser(currentEmployeeId || user.uid, selectedCompany.id);
      setAssignedTasks(tasks as BusinessTask[]);

      if (sheets.length > 0) {
        const loaded = sheets[0];
        // Herbereken weektotaal om werkactiviteitsuren altijd correct mee te tellen,
        // ook voor opgeslagen sheets uit vóór de werkactiviteitsuren-fix.
        const recalcTotals = calculateWeekTotals(loaded.entries);
        setCurrentTimesheet({
          ...loaded,
          totalRegularHours: recalcTotals.regularHours,
          totalTravelKilometers: recalcTotals.travelKilometers,
        });
      } else {
        const weekDates = getWeekDates(selectedYear, selectedWeek);
        // ✅ FIX: Gebruik employee.companyId (employer/Buddy) ipv selectedCompany.id
        // Timesheets moeten altijd naar de employer gaan, niet naar het project
        const employerCompanyId = employee.companyId || employee.payrollCompanyId || selectedCompany.id;

        const emptyEntries: TimesheetEntry[] = weekDates.map(date => ({
          userId: queryUserId,
          employeeId: effectiveEmployeeId,
          companyId: employerCompanyId,
          branchId: employee.branchId,
          date,
          regularHours: 0,
          overtimeHours: 0,
          eveningHours: 0,
          nightHours: 0,
          weekendHours: 0,
          travelKilometers: 0,
          notes: '',
          createdAt: new Date(),
          updatedAt: new Date()
        }));

        const newTimesheet: WeeklyTimesheet = {
          userId: queryUserId,
          employeeId: effectiveEmployeeId,
          companyId: employerCompanyId,
          branchId: employee.branchId,
          weekNumber: selectedWeek,
          year: selectedYear,
          entries: emptyEntries,
          totalRegularHours: 0,
          totalOvertimeHours: 0,
          totalEveningHours: 0,
          totalNightHours: 0,
          totalWeekendHours: 0,
          totalTravelKilometers: 0,
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        setCurrentTimesheet(newTimesheet);
      }
    } catch (error) {
      console.error('Error loading timesheets:', error);
      showError('Fout bij laden', 'Kan urenregistratie niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, queryUserId, userRole, currentEmployeeId, selectedEmployeeId, selectedCompany, selectedYear, selectedWeek, showError]);

  const handleImportFromITKnecht = async () => {
    if (!selectedCompany || !employeeData) {
      showError('Fout', 'Selecteer eerst een bedrijf en werknemer');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch('https://hook.eu2.make.com/wh18u8c7x989zoakqxqmomjoy2cpfd3b', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_hours_data',
          monteur: employeeData.personalInfo.firstName + ' ' + employeeData.personalInfo.lastName,
          week: selectedWeek,
          year: selectedYear,
          companyId: selectedCompany.id
        })
      });

      if (!response.ok) {
        throw new Error('Webhook call failed');
      }

      const itknechtData = await response.json();
      
      if (itknechtData && Array.isArray(itknechtData) && itknechtData.length > 0) {
        await processITKnechtData(itknechtData);
        success('Import geslaagd', `${itknechtData.length} ITKnecht entries geïmporteerd`);
        await loadData();
      } else {
        showError('Geen data', 'Geen ITKnecht uren gevonden voor deze week/monteur');
      }

    } catch (error) {
      console.error('Error importing from ITKnecht:', error);
      showError('Import fout', 'Kon ITKnecht uren niet ophalen');
    } finally {
      setImporting(false);
    }
  };

  const processITKnechtData = async (itknechtEntries: any[]) => {
    if (!currentTimesheet || !employeeData) return;

    const normalizedEntries = itknechtEntries.map(record => {
      const data = record.data || record;
      return {
        dag: data.Dag || '',
        totaal_factuureerbare_uren: parseFloat(data['Totaal factureerbare uren'] || 0),
        gereden_kilometers: parseFloat(data['Gereden kilometers'] || 0)
      };
    });

    const entriesByDay: { [key: string]: any[] } = {};
    
    normalizedEntries.forEach(entry => {
      const day = entry.dag;
      if (!entriesByDay[day]) {
        entriesByDay[day] = [];
      }
      entriesByDay[day].push(entry);
    });

    const updatedEntries = [...currentTimesheet.entries];
    
    Object.keys(entriesByDay).forEach(day => {
      const dayEntries = entriesByDay[day];
      
      const dayTotalHours = dayEntries.reduce((sum, entry) => {
        return sum + entry.totaal_factuureerbare_uren;
      }, 0);
      
      const dayTotalKm = dayEntries.reduce((sum, entry) => {
        return sum + entry.gereden_kilometers;
      }, 0);

      const dayIndex = updatedEntries.findIndex(entry => {
        const dayName = getDayName(entry.date);
        return dayName.toLowerCase() === day.toLowerCase();
      });

      if (dayIndex !== -1) {
        // Markeer als ITKnecht-import via notes "Productie uren Riset".
        // De term "Riset" is gereserveerd: handmatige invoer wordt
        // geblokkeerd in updateEntry/updateWorkActivity, dus deze marker
        // is een betrouwbare bron voor read-only detectie.
        updatedEntries[dayIndex] = {
          ...updatedEntries[dayIndex],
          regularHours: dayTotalHours,
          travelKilometers: dayTotalKm,
          overtimeHours: 0,
          eveningHours: 0,
          nightHours: 0,
          weekendHours: 0,
          notes: 'Productie uren Riset',
          dayStatus: 'worked',
          updatedAt: new Date()
        };
      }
    });

    const totals = calculateWeekTotals(updatedEntries);

    const updatedTimesheet = {
      ...currentTimesheet,
      entries: updatedEntries,
      totalRegularHours: totals.regularHours,
      totalOvertimeHours: 0,
      totalEveningHours: 0,
      totalNightHours: 0,
      totalWeekendHours: 0,
      totalTravelKilometers: totals.travelKilometers,
      updatedAt: new Date()
    };

    setCurrentTimesheet(updatedTimesheet);

    if (updatedTimesheet.id) {
      await updateWeeklyTimesheet(updatedTimesheet.id, queryUserId!, updatedTimesheet);
    } else {
      const id = await createWeeklyTimesheet(queryUserId!, updatedTimesheet);
      setCurrentTimesheet({ ...updatedTimesheet, id });
    }
  };

  useEffect(() => {
    if ((userRole === 'admin' || userRole === 'co-admin' || userRole === 'manager') && !selectedEmployeeId && selectedCompany) {
      const companyEmployees = employees.filter(emp => emp.companyId === selectedCompany.id);
      if (userRole === 'manager' && currentEmployeeId) {
        const own = companyEmployees.find(emp => emp.id === currentEmployeeId);
        setSelectedEmployeeId(own ? own.id : companyEmployees[0]?.id || '');
      } else if (companyEmployees.length > 0) {
        setSelectedEmployeeId(companyEmployees[0].id);
      }
    }
  }, [userRole, selectedEmployeeId, selectedCompany, employees, currentEmployeeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-patch: zodra timesheet + verlof/ziek-data binnen zijn, vul
  // ontbrekende dayStatus voor verlof/ziek-dagen direct in. Hierdoor ziet
  // de monteur de status meteen, niet pas na een gefaalde submit.
  useEffect(() => {
    if (!currentTimesheet?.id || !queryUserId) return;
    const patched = currentTimesheet.entries.map((e) => {
      if (e.dayStatus) return e;
      const sick = weekSickLeaves.find((s) => {
        const start = s.startDate instanceof Date ? s.startDate : new Date(s.startDate);
        const end = s.endDate ? (s.endDate instanceof Date ? s.endDate : new Date(s.endDate)) : new Date();
        const d = new Date(e.date); d.setHours(0, 0, 0, 0);
        const ss = new Date(start); ss.setHours(0, 0, 0, 0);
        const ee = new Date(end); ee.setHours(0, 0, 0, 0);
        return d >= ss && d <= ee;
      });
      if (sick) return { ...e, dayStatus: 'sick' as const };
      const leave = weekLeaveRequests.find((l) => {
        const start = l.startDate instanceof Date ? l.startDate : new Date(l.startDate);
        const end = l.endDate instanceof Date ? l.endDate : new Date(l.endDate);
        const d = new Date(e.date); d.setHours(0, 0, 0, 0);
        const ss = new Date(start); ss.setHours(0, 0, 0, 0);
        const ee = new Date(end); ee.setHours(0, 0, 0, 0);
        return d >= ss && d <= ee;
      });
      if (leave) return { ...e, dayStatus: 'holiday' as const };
      if (isPublicHoliday(new Date(e.date))) return { ...e, dayStatus: 'holiday_public' as const };
      return e;
    });
    const changed = patched.some((e, i) => e.dayStatus !== currentTimesheet.entries[i].dayStatus);
    if (changed) {
      setCurrentTimesheet({ ...currentTimesheet, entries: patched });
      updateWeeklyTimesheet(currentTimesheet.id, queryUserId, { entries: patched }).catch((err) => {
        console.error('[Timesheets] auto-patch leave/sick dayStatus failed:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTimesheet?.id, weekLeaveRequests, weekSickLeaves]);

  // Gereserveerde term voor automatische ITKnecht-import. Mag niet
  // voorkomen in handmatige tekst-velden — voorkomt fraude waarbij een
  // monteur valse uren onder de naam "Riset" registreert.
  const FORBIDDEN_RISET = /\briset\b/i;
  const RISET_VELDEN = new Set<keyof TimesheetEntry>(['notes', 'statusReason', 'effortNote']);

  const updateEntry = (index: number, field: keyof TimesheetEntry, value: number | string) => {
    if (!currentTimesheet) return;

    if (
      typeof value === 'string' &&
      RISET_VELDEN.has(field) &&
      FORBIDDEN_RISET.test(value)
    ) {
      showError(
        'Term niet toegestaan',
        'De term "Riset" is gereserveerd voor automatische ITKnecht-import. Beschrijf je werkzaamheden anders.'
      );
      // Paper trail — fire-and-forget, blokkeert de UI niet
      AuditService.logAction(
        queryUserId!,
        'update' as any,
        'time_entry' as any,
        currentTimesheet.id || 'draft',
        {
          companyId: currentTimesheet.companyId,
          severity: 'critical' as any,
          metadata: {
            reason: 'riset_attempt_field',
            field: String(field),
            attemptedValue: (value as string).slice(0, 100),
            employeeId: currentTimesheet.employeeId,
            weekNumber: currentTimesheet.weekNumber,
            year: currentTimesheet.year,
          },
          performedBy: {
            uid: user?.uid || queryUserId!,
            email: user?.email || 'unknown',
            role: (userRole as any) || 'employee',
          },
        }
      ).catch(() => {});
      // Forceer re-render zodat React het controlled input terugzet naar
      // de vorige waarde (zonder dit blijft de DOM-waarde staan ondanks
      // dat state niet is gewijzigd).
      setCurrentTimesheet(ts => ts ? { ...ts } : ts);
      return;
    }

    const updatedEntries = [...currentTimesheet.entries];
    updatedEntries[index] = {
      ...updatedEntries[index],
      [field]: value,
      updatedAt: new Date()
    };

    // Begin-/eindstand → dagkilometers automatisch afleiden
    if (field === 'startKilometers' || field === 'endKilometers') {
      const base = assignedVehicle?.currentMileage;
      if (typeof base === 'number') {
        // Gekoppelde auto: beginstand komt van de auto/vorige dag → keten herberekenen
        const chained = recalcKmChain(updatedEntries, base);
        for (let i = 0; i < chained.length; i++) updatedEntries[i] = chained[i];
      } else {
        // Geen auto: handmatige begin/eind invoer
        const start = updatedEntries[index].startKilometers;
        const end = updatedEntries[index].endKilometers;
        if (typeof start === 'number' && typeof end === 'number' && end >= start) {
          updatedEntries[index].travelKilometers = Math.max(0, end - start);
        }
      }
    }

    const totals = calculateWeekTotals(updatedEntries);

    setCurrentTimesheet({
      ...currentTimesheet,
      entries: updatedEntries,
      totalRegularHours: totals.regularHours,
      totalOvertimeHours: totals.overtimeHours,
      totalEveningHours: totals.eveningHours,
      totalNightHours: totals.nightHours,
      totalWeekendHours: totals.weekendHours,
      totalTravelKilometers: totals.travelKilometers,
      updatedAt: new Date()
    });
  };

  const addWorkActivity = (entryIndex: number) => {
    if (!currentTimesheet) return;

    const updatedEntries = [...currentTimesheet.entries];
    const entry = updatedEntries[entryIndex];
    
    const newActivity = {
      hours: 0,
      description: '',
      clientId: '',
      isITKnechtImport: false
    };

    updatedEntries[entryIndex] = {
      ...entry,
      workActivities: [...(entry.workActivities || []), newActivity],
      updatedAt: new Date()
    };

    setCurrentTimesheet({
      ...currentTimesheet,
      entries: updatedEntries,
      updatedAt: new Date()
    });
  };

  const updateWorkActivity = (entryIndex: number, activityIndex: number, field: keyof WorkActivity, value: WorkActivity[keyof WorkActivity]) => {
    if (!currentTimesheet) return;

    const existing = currentTimesheet.entries[entryIndex]?.workActivities?.[activityIndex];
    if (
      field === 'description' &&
      typeof value === 'string' &&
      !existing?.isITKnechtImport &&
      FORBIDDEN_RISET.test(value)
    ) {
      showError(
        'Term niet toegestaan',
        'De term "Riset" is gereserveerd voor automatische ITKnecht-import. Beschrijf je werkzaamheden anders.'
      );
      AuditService.logAction(
        queryUserId!,
        'update' as any,
        'time_entry' as any,
        currentTimesheet.id || 'draft',
        {
          companyId: currentTimesheet.companyId,
          severity: 'critical' as any,
          metadata: {
            reason: 'riset_attempt_activity',
            field: 'workActivity.description',
            attemptedValue: (value as string).slice(0, 100),
            employeeId: currentTimesheet.employeeId,
            weekNumber: currentTimesheet.weekNumber,
            year: currentTimesheet.year,
          },
          performedBy: {
            uid: user?.uid || queryUserId!,
            email: user?.email || 'unknown',
            role: (userRole as any) || 'employee',
          },
        }
      ).catch(() => {});
      setCurrentTimesheet(ts => ts ? { ...ts } : ts);
      return;
    }

    const updatedEntries = [...currentTimesheet.entries];
    const entry = updatedEntries[entryIndex];
    const activities = [...(entry.workActivities || [])];

    activities[activityIndex] = {
      ...activities[activityIndex],
      [field]: value
    };

    updatedEntries[entryIndex] = {
      ...entry,
      workActivities: activities,
      updatedAt: new Date()
    };

    // Recalculate totals INCLUDING non-riset workActivities
    let totalRegularHours = 0;
    let totalTravelKilometers = 0;

    updatedEntries.forEach(e => {
      totalRegularHours += e.regularHours || 0;

      if (e.workActivities && e.workActivities.length > 0) {
        e.workActivities.forEach(activity => {
          if (!activity.isITKnechtImport) {
            totalRegularHours += activity.hours || 0;
          }
        });
      }

      totalTravelKilometers += e.travelKilometers || 0;
    });

    setCurrentTimesheet({
      ...currentTimesheet,
      entries: updatedEntries,
      totalRegularHours: totalRegularHours,
      totalTravelKilometers: totalTravelKilometers,
      updatedAt: new Date()
    });
  };

  const selectProjectForActivity = (entryIndex: number, activityIndex: number, projectId: string) => {
    if (!currentTimesheet) return;
    const project = internalProjects.find(p => p.id === projectId);
    const updatedEntries = [...currentTimesheet.entries];
    const activities = [...(updatedEntries[entryIndex].workActivities || [])];
    activities[activityIndex] = {
      ...activities[activityIndex],
      internalProjectId: project?.id || '',
      internalProjectName: project?.name || '',
      description: activities[activityIndex].description || project?.name || '',
      taskId: '',
    };
    updatedEntries[entryIndex] = { ...updatedEntries[entryIndex], workActivities: activities, updatedAt: new Date() };
    setCurrentTimesheet({ ...currentTimesheet, entries: updatedEntries, updatedAt: new Date() });
  };

  const selectTaskForActivity = (entryIndex: number, activityIndex: number, taskId: string) => {
    if (!currentTimesheet) return;
    const task = assignedTasks.find(t => t.id === taskId);
    const updatedEntries = [...currentTimesheet.entries];
    const activities = [...(updatedEntries[entryIndex].workActivities || [])];
    activities[activityIndex] = {
      ...activities[activityIndex],
      taskId: task?.id || '',
      description: task?.title || activities[activityIndex].description,
      hours: task?.estimatedHours ?? activities[activityIndex].hours,
    };
    updatedEntries[entryIndex] = { ...updatedEntries[entryIndex], workActivities: activities, updatedAt: new Date() };

    let totalRegularHours = 0;
    let totalTravelKilometers = 0;
    updatedEntries.forEach(e => {
      totalRegularHours += e.regularHours || 0;
      (e.workActivities || []).forEach(wa => {
        if (!wa.isITKnechtImport) totalRegularHours += wa.hours || 0;
      });
      totalTravelKilometers += e.travelKilometers || 0;
    });

    setCurrentTimesheet({ ...currentTimesheet, entries: updatedEntries, totalRegularHours, totalTravelKilometers, updatedAt: new Date() });
  };

  const removeWorkActivity = (entryIndex: number, activityIndex: number) => {
    if (!currentTimesheet) return;

    const updatedEntries = [...currentTimesheet.entries];
    const entry = updatedEntries[entryIndex];
    const activities = [...(entry.workActivities || [])];
    
    activities.splice(activityIndex, 1);

    updatedEntries[entryIndex] = {
      ...entry,
      workActivities: activities,
      updatedAt: new Date()
    };

    setCurrentTimesheet({
      ...currentTimesheet,
      entries: updatedEntries,
      updatedAt: new Date()
    });
  };

  // Stempelt de gekoppelde auto op dagen met een kilometerstand zodat de
  // koppeling persistent is en de admin het kenteken bij de uren ziet.
  const stampVehicleOnEntries = (ts: WeeklyTimesheet): WeeklyTimesheet => {
    if (!assignedVehicle?.id) return ts;
    // Keten herberekenen op basis van de auto-tellerstand zodat opgeslagen
    // begin-/eindstanden en dagkilometers kloppen.
    let entries = typeof assignedVehicle.currentMileage === 'number'
      ? recalcKmChain(ts.entries, assignedVehicle.currentMileage)
      : ts.entries;
    entries = entries.map((e) =>
      typeof e.endKilometers === 'number' || typeof e.startKilometers === 'number'
        ? { ...e, vehicleId: assignedVehicle.id, vehicleKenteken: assignedVehicle.kenteken }
        : e
    );
    const totals = calculateWeekTotals(entries);
    return { ...ts, entries, totalTravelKilometers: totals.travelKilometers };
  };

  // Slaat per dag een persistente rit-log op de auto op (met monteurnaam-snapshot),
  // zodat de historie compleet blijft ook na een wissel van bestuurder.
  const pushTripLogs = (ts: WeeklyTimesheet, tsId?: string) => {
    if (!assignedVehicle?.id || !queryUserId || !tsId) return;
    const name = employeeData
      ? [employeeData.personalInfo?.firstName, employeeData.personalInfo?.lastName].filter(Boolean).join(' ')
      : undefined;
    saveVehicleDayLogs({
      timesheetId: tsId,
      vehicleId: assignedVehicle.id,
      vehicleKenteken: assignedVehicle.kenteken,
      userId: queryUserId,
      companyId: ts.companyId,
      employeeId: ts.employeeId,
      employeeName: name || undefined,
      entries: ts.entries,
    }).catch(() => {});
  };

  // Werkt de tellerstand van de gekoppelde auto bij naar de hoogste eindstand
  // van de week (loopt mee in Auto-beheer). Fire-and-forget — blokkeert niet.
  const pushMileageToVehicle = (ts: WeeklyTimesheet) => {
    if (!assignedVehicle?.id || !queryUserId) return;
    const readings = ts.entries
      .filter((e) => typeof e.endKilometers === 'number' && (e.endKilometers as number) > 0)
      .sort((a, b) => (b.endKilometers as number) - (a.endKilometers as number));
    const top = readings[0];
    if (!top) return;
    updateVehicleMileage(assignedVehicle.id, top.endKilometers as number, {
      userId: queryUserId,
      companyId: ts.companyId,
      date: new Date(top.date),
      employeeId: ts.employeeId,
      source: 'timesheet',
    }).catch(() => {});
  };

  const handleSave = async () => {
    if (!currentTimesheet || !user || !queryUserId || !employeeData) return;

    setSaving(true);
    try {
      const toSave = stampVehicleOnEntries(currentTimesheet);
      if (currentTimesheet.id) {
        await updateWeeklyTimesheet(
          currentTimesheet.id,
          queryUserId,
          toSave
        );
        pushTripLogs(toSave, currentTimesheet.id);
        success('Uren opgeslagen', 'Urenregistratie succesvol opgeslagen');
      } else {
        const id = await createWeeklyTimesheet(
          queryUserId,
          toSave
        );
        setCurrentTimesheet({ ...toSave, id });
        pushTripLogs(toSave, id);
        success('Uren aangemaakt', 'Urenregistratie succesvol aangemaakt');
      }
      // Let op: de auto-tellerstand wordt NIET bij een concept-opslag bijgewerkt,
      // alleen bij indienen. Anders zou de keten-basis (beginstand week) bij
      // herladen meeschuiven met de eigen eindstanden en de week corrumperen.
    } catch (error) {
      console.error('Error saving timesheet:', error);
      showError('Fout bij opslaan', 'Kon urenregistratie niet opslaan');
    } finally {
      setSaving(false);
    }
  };

  const handleResetWeek = async () => {
    if (!currentTimesheet?.id || !queryUserId) return;
    if (currentTimesheet.status !== 'draft') {
      showError('Niet toegestaan', 'Alleen concept-weken kunnen worden geleegd.');
      return;
    }
    const confirmed = window.confirm(
      'Weet je zeker dat je alle ingevulde uren van deze week wilt verwijderen?\n\nDit kan niet ongedaan worden gemaakt. Daarna kun je opnieuw ophalen of handmatig invullen.'
    );
    if (!confirmed) return;

    const emptyEntries: TimesheetEntry[] = currentTimesheet.entries.map((e) => ({
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
      notes: '',
      workActivities: [],
      updatedAt: new Date(),
    }));

    setSaving(true);
    try {
      await updateWeeklyTimesheet(currentTimesheet.id, queryUserId, {
        entries: emptyEntries,
        totalRegularHours: 0,
        totalOvertimeHours: 0,
        totalEveningHours: 0,
        totalNightHours: 0,
        totalWeekendHours: 0,
        totalTravelKilometers: 0,
        lowHoursReview: undefined,
        updatedAt: new Date(),
      });
      setCurrentTimesheet({
        ...currentTimesheet,
        entries: emptyEntries,
        totalRegularHours: 0,
        totalOvertimeHours: 0,
        totalEveningHours: 0,
        totalNightHours: 0,
        totalWeekendHours: 0,
        totalTravelKilometers: 0,
        lowHoursReview: undefined,
        updatedAt: new Date(),
      });
      success('Week geleegd', 'Alle uren zijn verwijderd. Je kunt nu opnieuw ophalen of invullen.');
    } catch (err) {
      console.error('Error resetting week:', err);
      showError('Fout bij legen', 'Kon week niet legen');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentTimesheet || !currentTimesheet.id || !user || !queryUserId || !employeeData) return;

    if (currentTimesheet.totalRegularHours === 0 && currentTimesheet.totalTravelKilometers === 0) {
      const confirmed = window.confirm(
        'Je hebt 0 uur en 0 kilometer ingevuld voor deze week.\n\nHeb je de uren al opgehaald via ITKnecht?\n\nKlik OK om toch in te dienen, Annuleren om terug te gaan.'
      );
      if (!confirmed) return;
    }

    // Per-dag effort-check: gewerkt <8u zonder toelichting blokkeert indienen.
    // Weekend (za/zo) is niet verplicht — die slaan we over.
    const daysNeedingEffort = currentTimesheet.entries.filter((e) => {
      const dow = new Date(e.date).getDay();
      if (dow === 0 || dow === 6) return false; // weekend
      const status = e.dayStatus || (e.regularHours > 0 ? 'worked' : '');
      const totalDayHours = (e.regularHours || 0) +
        (e.workActivities || []).filter(wa => !wa.isITKnechtImport).reduce((sum, wa) => sum + (wa.hours || 0), 0);
      return status === 'worked' && totalDayHours > 0 && totalDayHours < 8 && !(e.effortNote && e.effortNote.trim());
    });
    if (daysNeedingEffort.length > 0) {
      const dagen = daysNeedingEffort
        .map((e) => new Date(e.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' }))
        .join(', ');
      showError(
        'Effort-toelichting vereist',
        `Bij minder dan 8 uur gewerkt moet je per dag aangeven wat je hebt gedaan om toch waarde toe te voegen (bv. kantoor gebeld/geappt). Ontbreekt nog: ${dagen}.`
      );
      return;
    }

    // < 40u in de week (exclusief weekend) → 3-vraag review-modal vereist.
    // Ook wanneer een dag op 'Geen / half werk uitgevoerd' staat triggeren we
    // de review automatisch — die status impliceert te lage uren, ongeacht
    // het weektotaal. Al eerder ingevuld? Dan slaan we de modal over.
    const actualWeeklyHours = currentTimesheet.totalRegularHours;
    const LOW_HOURS_THRESHOLD = 40;
    const hasPartialWorkDay = currentTimesheet.entries.some((e) => e.dayStatus === 'partial_work');
    if ((actualWeeklyHours < LOW_HOURS_THRESHOLD || hasPartialWorkDay) && !currentTimesheet.lowHoursReview) {
      setShowLowHoursModal(true);
      return; // wacht op modal-submit
    }

    setSaving(true);
    try {
      // Sla eerst de actuele state op zodat werkactiviteiten niet verloren gaan
      const toSave = stampVehicleOnEntries(currentTimesheet);
      await updateWeeklyTimesheet(currentTimesheet.id, queryUserId, toSave);
      await submitWeeklyTimesheet(
        currentTimesheet.id,
        queryUserId,
        user.displayName || user.email || 'Werknemer'
      );
      pushTripLogs(toSave, currentTimesheet.id);
      pushMileageToVehicle(toSave);
      success('Uren ingediend', 'Urenregistratie succesvol ingediend voor goedkeuring');
      await loadData();
    } catch (error: any) {
      console.error('Error submitting timesheet:', error);
      // Gap-check faal: toon lijst van ontbrekende werkdagen met uitleg
      // en open de eerste ontbrekende dag direct voor de monteur.
      if (error?.name === 'IncompleteWeekError' && Array.isArray(error.missingDates)) {
        const dagen = error.missingDates
          .map((d: Date) => new Date(d).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' }))
          .join(', ');
        showError(
          'Week niet compleet',
          `Geef eerst voor elke werkdag aan wat je deed (gewerkt / verlof / ziek / onbetaald / overleg). Ontbreekt nog: ${dagen}.`
        );
        const isSameDay = (a: Date, b: Date) => {
          const da = new Date(a); da.setHours(0, 0, 0, 0);
          const db = new Date(b); db.setHours(0, 0, 0, 0);
          return da.getTime() === db.getTime();
        };
        const firstMissingIdx = currentTimesheet.entries.findIndex((e) =>
          error.missingDates.some((d: Date) => isSameDay(new Date(d), new Date(e.date)))
        );
        if (firstMissingIdx >= 0) setExpandedDay(firstMissingIdx);
      } else if (error?.message && /\bRiset\b/.test(error.message)) {
        showError('Term niet toegestaan', error.message);
      } else {
        showError('Fout bij indienen', 'Kon urenregistratie niet indienen');
      }
    } finally {
      setSaving(false);
    }
  };

  /**
   * Low-hours review modal submit: sla antwoorden op, sluit modal en
   * triggert handleSubmit opnieuw (die ziet nu lowHoursReview bestaat
   * en slaat de modal over).
   */
  const handleLowHoursReviewSubmit = async () => {
    if (!currentTimesheet || !currentTimesheet.id || !queryUserId) return;
    const { dailyContact, effortInvested, suggestions, suggestionsSelf } = reviewAnswers;
    if (!dailyContact.trim() || !effortInvested.trim() || !suggestions.trim()) {
      showError('Alle vragen vereist', 'Beantwoord alle drie de vragen voordat je indient.');
      return;
    }
    // Soft-check: als suggesties opdrachtgevers blamen, eis een tweede
    // antwoord over wat de werknemer/het team zelf kan doen.
    const needsSelfReflection = containsOpdrachtgeverBlame(suggestions);
    if (needsSelfReflection && !suggestionsSelf.trim()) {
      showError(
        'Aanvullend antwoord vereist',
        'Je suggestie verwijst naar een opdrachtgever — geef ook aan wat jij of het team zelf kunnen doen.'
      );
      return;
    }
    const review: any = {
      dailyContact: dailyContact.trim(),
      effortInvested: effortInvested.trim(),
      suggestions: suggestions.trim(),
      submittedAt: new Date(),
      actualWeeklyHours: currentTimesheet.totalRegularHours,
    };
    if (needsSelfReflection && suggestionsSelf.trim()) {
      review.suggestionsSelf = suggestionsSelf.trim();
    }
    try {
      // Sla review + actuele entries op in één write
      await updateWeeklyTimesheet(currentTimesheet.id, queryUserId, {
        ...currentTimesheet,
        lowHoursReview: review,
      });
      const updated = { ...currentTimesheet, lowHoursReview: review };
      setCurrentTimesheet(updated);
      setShowLowHoursModal(false);
      setReviewAnswers({ dailyContact: '', effortInvested: '', suggestions: '', suggestionsSelf: '' });
      // Direct indienen — review + entries zijn nu opgeslagen.
      setSaving(true);
      await submitWeeklyTimesheet(
        currentTimesheet.id,
        queryUserId,
        user?.displayName || user?.email || 'Werknemer'
      );
      success('Uren ingediend', 'Review + urenregistratie succesvol ingediend.');
      await loadData();
    } catch (err: any) {
      console.error('[Timesheets] low-hours review submit failed:', err);
      if (err?.name === 'IncompleteWeekError') {
        const dagen = (err.missingDates || [])
          .map((d: Date) => new Date(d).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' }))
          .join(', ');
        showError('Week niet compleet', `Nog openstaande werkdagen: ${dagen}`);
        const isSameDay = (a: Date, b: Date) => {
          const da = new Date(a); da.setHours(0, 0, 0, 0);
          const db = new Date(b); db.setHours(0, 0, 0, 0);
          return da.getTime() === db.getTime();
        };
        const idx = currentTimesheet.entries.findIndex((e) =>
          (err.missingDates || []).some((d: Date) => isSameDay(new Date(d), new Date(e.date)))
        );
        if (idx >= 0) setExpandedDay(idx);
      } else if (err?.message && /\bRiset\b/.test(err.message)) {
        showError('Term niet toegestaan', err.message);
      } else {
        showError('Fout', 'Kon review + urenregistratie niet indienen.');
      }
    } finally {
      setSaving(false);
    }
  };

  const changeWeek = (delta: number) => {
    let newWeek = selectedWeek + delta;
    let newYear = selectedYear;

    if (newWeek < 1) {
      newWeek = 52;
      newYear--;
    } else if (newWeek > 52) {
      newWeek = 1;
      newYear++;
    }

    setSelectedWeek(newWeek);
    setSelectedYear(newYear);
  };

  const getDayName = (date: Date): string => {
    const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
    return days[date.getDay()];
  };

  // Helper: Check of een dag verlof heeft
  const getDayLeave = (date: Date): LeaveRequest | undefined => {
    return weekLeaveRequests.find(leave => {
      const leaveStart = leave.startDate instanceof Date ? leave.startDate : new Date(leave.startDate);
      const leaveEnd = leave.endDate instanceof Date ? leave.endDate : new Date(leave.endDate);
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      leaveStart.setHours(0, 0, 0, 0);
      leaveEnd.setHours(0, 0, 0, 0);
      return checkDate >= leaveStart && checkDate <= leaveEnd;
    });
  };

  // Helper: Check of een dag ziek is
  const getDaySick = (date: Date): SickLeave | undefined => {
    return weekSickLeaves.find(sick => {
      const sickStart = sick.startDate instanceof Date ? sick.startDate : new Date(sick.startDate);
      const sickEnd = sick.endDate
        ? (sick.endDate instanceof Date ? sick.endDate : new Date(sick.endDate))
        : new Date(); // Als geen einddatum, dan tot vandaag
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      sickStart.setHours(0, 0, 0, 0);
      sickEnd.setHours(0, 0, 0, 0);
      return checkDate >= sickStart && checkDate <= sickEnd;
    });
  };

  // Helper: Bereken verlof uren voor deze week
  const calculateWeekLeaveHours = (): number => {
    if (!currentTimesheet) return 0;
    const contractHoursPerDay = (employeeData?.contractInfo?.hoursPerWeek || 40) / 5;
    let leaveHours = 0;
    currentTimesheet.entries.forEach(entry => {
      const dayLeave = getDayLeave(entry.date);
      if (dayLeave) {
        // Alleen werkdagen tellen (ma-vr)
        const dayOfWeek = entry.date.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          leaveHours += contractHoursPerDay;
        }
      }
    });
    return leaveHours;
  };

  // Helper: Bereken ziekte uren voor deze week
  const calculateWeekSickHours = (): number => {
    if (!currentTimesheet) return 0;
    const contractHoursPerDay = (employeeData?.contractInfo?.hoursPerWeek || 40) / 5;
    let sickHours = 0;
    currentTimesheet.entries.forEach(entry => {
      const daySick = getDaySick(entry.date);
      if (daySick && !getDayLeave(entry.date)) { // Geen dubbeltelling met verlof
        // Alleen werkdagen tellen (ma-vr)
        const dayOfWeek = entry.date.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          // Reken met werkpercentage
          const workPercentage = daySick.workCapacityPercentage || 0;
          sickHours += contractHoursPerDay * ((100 - workPercentage) / 100);
        }
      }
    });
    return sickHours;
  };

  // Helper: Get leave type label
  const getLeaveTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      holiday: 'Vakantie',
      sick: 'Ziek',
      special: 'Bijzonder verlof',
      unpaid: 'Onbetaald verlof',
      parental: 'Ouderschapsverlof',
      care: 'Zorgverlof',
      short_leave: 'Kort verzuim',
      adv: 'ADV',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!selectedCompany) {
    return (
      <div className="space-y-6 px-4 sm:px-0">
        <div className="hidden lg:block">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Urenregistratie</h1>
        </div>
        <EmptyState
          icon={Clock}
          title="Geen bedrijf geselecteerd"
          description="Selecteer een bedrijf uit de dropdown in de zijbalk om uren te registreren."
        />
      </div>
    );
  }

  const companyEmployees = employees.filter(emp => emp.companyId === selectedCompany.id);
  const effectiveEmployeeId = (userRole === 'admin' || userRole === 'co-admin' || userRole === 'manager') ? (selectedEmployeeId || currentEmployeeId) : currentEmployeeId;

  if (!effectiveEmployeeId) {
    return (
      <div className="space-y-6 px-4 sm:px-0">
        <div className="hidden lg:block">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Urenregistratie</h1>
        </div>
        {(userRole === 'admin' || userRole === 'co-admin') && companyEmployees.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Geen werknemers gevonden"
            description="Er zijn geen werknemers voor dit bedrijf. Voeg eerst werknemers toe."
          />
        ) : (
          <EmptyState
            icon={Clock}
            title="Geen werknemer geselecteerd"
            description={(userRole === 'admin' || userRole === 'co-admin') ? 'Selecteer een werknemer uit de dropdown hierboven om uren te registreren.' : 'Selecteer een werknemer om uren te registreren.'}
          />
        )}
      </div>
    );
  }

  if (!currentTimesheet) {
    return (
      <EmptyState
        icon={Clock}
        title="Geen urenregistratie gevonden"
        description="Er is een probleem opgetreden bij het laden of aanmaken van de urenregistratie."
      />
    );
  }

  const isReadOnly = currentTimesheet.status !== 'draft' && currentTimesheet.status !== 'rejected';
  const contractHours = employeeData?.contractInfo?.hoursPerWeek || 40;
  const workDays = currentTimesheet.entries.filter(e => e.regularHours > 0).length;
  const avgHours = workDays > 0 ? currentTimesheet.totalRegularHours / workDays : 0;
  const isUnderContract = currentTimesheet.totalRegularHours < (contractHours * 0.85);

  return (
    <div className="space-y-3 sm:space-y-6 px-4 sm:px-0 pb-24 sm:pb-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="hidden lg:block">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Urenregistratie</h1>
          {employeeData && (
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-2 flex items-center gap-2">
              <User className="h-4 w-4" />
              {employeeData.personalInfo.firstName} {employeeData.personalInfo.lastName}
            </p>
          )}
        </div>

        {/* Week Navigation + Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => changeWeek(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Vorige week"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
            <div className="text-center px-4 min-w-[120px]">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Week {selectedWeek}</p>
              <p className="text-xs text-gray-500 dark:text-gray-300">{selectedYear}</p>
            </div>
            <button
              onClick={() => changeWeek(1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Volgende week"
            >
              <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Employee Selector (Admin/Manager) */}
          {(userRole === 'admin' || userRole === 'co-admin' || userRole === 'manager') && companyEmployees.length > 1 && (
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Selecteer werknemer</option>
              {companyEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                </option>
              ))}
            </select>
          )}

          {/* Import Button - Altijd tonen voor alle bedrijven */}
          {effectiveEmployeeId && selectedCompany && (
            <Button
              onClick={handleImportFromITKnecht}
              disabled={importing || saving}
              variant="secondary"
              size="sm"
              className="text-xs sm:text-sm"
            >
              {importing ? (
                <>
                  <LoadingSpinner className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  Laden...
                </>
              ) : (
                <>
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  Ophalen
                </>
              )}
            </Button>
          )}

          {/* Week legen — alleen op draft-weken die al opgeslagen zijn */}
          {effectiveEmployeeId && selectedCompany && currentTimesheet?.id && currentTimesheet?.status === 'draft' && (
            <Button
              onClick={handleResetWeek}
              disabled={saving || importing}
              variant="secondary"
              size="sm"
              className="text-xs sm:text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              Week legen
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      {currentTimesheet.status === 'submitted' && (
        <div className="p-4 rounded-xl border-2 border-blue-400 dark:border-blue-600 bg-blue-50 dark:!bg-gray-700 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
            <Send className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-blue-800 dark:text-blue-200">Week ingediend — wacht op goedkeuring</p>
            <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">
              Ingediend op {currentTimesheet.submittedAt ? new Date(currentTimesheet.submittedAt).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '—'}
            </p>
          </div>
        </div>
      )}
      {currentTimesheet.status === 'approved' && (
        <div className="p-4 rounded-xl border-2 border-green-400 dark:border-green-600 bg-green-50 dark:!bg-gray-700 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-green-800 dark:text-green-200">Week goedgekeurd</p>
            <p className="text-xs text-green-600 dark:text-green-300 mt-0.5">
              Goedgekeurd door {currentTimesheet.approvedBy || 'beheerder'}
            </p>
          </div>
        </div>
      )}
      {currentTimesheet.status === 'rejected' && (
        <div className="p-4 rounded-xl border-2 border-red-400 dark:border-red-600 bg-red-50 dark:!bg-gray-700 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-200">Week afgekeurd — pas aan en dien opnieuw in</p>
            {currentTimesheet.rejectionReason && (
              <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">Reden: {currentTimesheet.rejectionReason}</p>
            )}
          </div>
        </div>
      )}
      {currentTimesheet.status === 'processed' && (
        <div className="p-3 rounded-lg border-l-4 border-gray-500 bg-gray-100 dark:!bg-gray-800 text-sm text-gray-700 dark:text-gray-300 font-medium">
          Week verwerkt
        </div>
      )}

      {/* Import Status */}
      {importing && (
        <div className="p-3 sm:p-4 bg-primary-50 dark:bg-gray-700 border border-primary-200 dark:border-primary-700 rounded-lg flex items-center gap-3 text-primary-600 dark:text-primary-400 text-sm">
          <LoadingSpinner className="h-4 w-4 sm:h-5 sm:w-5" />
          <span>Bezig met ophalen van data...</span>
        </div>
      )}

      {/* Week Summary */}
      {currentTimesheet && (
        <Card className="bg-gradient-to-br from-primary-50 to-primary-100/50 dark:bg-gray-800 dark:from-gray-800 dark:to-gray-800 border-primary-200 dark:border-gray-600 p-4 sm:p-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Week {selectedWeek} Overzicht</h3>

            {isUnderContract && (
              <div className="p-3 bg-yellow-50 dark:bg-gray-700 border border-yellow-200 dark:border-yellow-700 rounded text-sm text-yellow-700 dark:text-yellow-300 flex gap-2">
                <span>⚠️</span>
                <div>
                  <strong>Onder contract uren:</strong> {currentTimesheet.totalRegularHours}u van {contractHours}u
                  {currentTimesheet.lowHoursExplanation && (
                    <p className="mt-1 text-xs">Verklaring: {currentTimesheet.lowHoursExplanation}</p>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2 sm:p-3 bg-white dark:bg-gray-900 rounded-lg text-center border border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1 font-medium">Totaal</p>
                <p className="text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400">{currentTimesheet.totalRegularHours}u</p>
              </div>
              <div className="p-2 sm:p-3 bg-white dark:bg-gray-900 rounded-lg text-center border border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1 font-medium">Kilometers</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{currentTimesheet.totalTravelKilometers}km</p>
              </div>
              <div className="p-2 sm:p-3 bg-white dark:bg-gray-900 rounded-lg text-center border border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1 font-medium">Werkdagen</p>
                <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{workDays}d</p>
              </div>
              <div className="p-2 sm:p-3 bg-white dark:bg-gray-900 rounded-lg text-center border border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1 font-medium">Gem./dag</p>
                <p className={`text-xl sm:text-2xl font-bold ${avgHours < 7 ? 'text-yellow-600 dark:text-yellow-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {avgHours.toFixed(1)}u
                </p>
              </div>
            </div>

            {/* Verlof & Ziekte Overzicht */}
            {(weekLeaveRequests.length > 0 || weekSickLeaves.length > 0) && (
              <div className="border-t border-primary-200 dark:border-primary-800 pt-3 mt-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Verlof & Verzuim deze week</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {calculateWeekLeaveHours() > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-gray-700 rounded-lg border border-emerald-100 dark:border-emerald-700">
                      <Palmtree className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                          {calculateWeekLeaveHours().toFixed(1)}u verlof
                        </p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                          {weekLeaveRequests.map(l => getLeaveTypeLabel(l.type)).join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                  {calculateWeekSickHours() > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-gray-700 rounded-lg border border-red-100 dark:border-red-700">
                      <HeartPulse className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-red-700 dark:text-red-300">
                          {calculateWeekSickHours().toFixed(1)}u ziek
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {weekSickLeaves.length} ziekmelding(en) actief
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Live completeness checklist — alleen bij draft. Geeft de
          monteur direct overzicht van wat er nog moet gebeuren voor
          inleveren, zodat hij niet pas op submit-faal ontdekt wat mist. */}
      {!isReadOnly && (() => {
        const items: Array<{ key: string; label: string; ok: boolean; dayIndex: number }> = [];
        currentTimesheet.entries.forEach((e, idx) => {
          const dow = new Date(e.date).getDay();
          if (dow === 0 || dow === 6) return;
          const dayLabel = new Date(e.date).toLocaleDateString('nl-NL', { weekday: 'long' });
          const dayLeave = getDayLeave(e.date);
          const daySick = getDaySick(e.date);
          const auto = daySick ? 'sick' : dayLeave ? 'holiday' : null;
          const eff = auto || e.dayStatus || (e.regularHours > 0 ? 'worked' : '');
          if (!eff) {
            items.push({ key: `s-${idx}`, label: `${dayLabel} — status ontbreekt`, ok: false, dayIndex: idx });
          } else if (
            eff === 'worked' &&
            (e.regularHours || 0) > 0 &&
            (e.regularHours || 0) < 8 &&
            !(e.effortNote && e.effortNote.trim())
          ) {
            items.push({ key: `e-${idx}`, label: `${dayLabel} — toelichting <8u ontbreekt`, ok: false, dayIndex: idx });
          } else {
            items.push({ key: `ok-${idx}`, label: `${dayLabel} — compleet`, ok: true, dayIndex: idx });
          }
        });
        const allOk = items.length > 0 && items.every((i) => i.ok);
        if (items.length === 0) return null;
        return (
          <div className={`rounded-xl border-2 p-3 sm:p-4 ${
            allOk
              ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-gray-800'
              : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-gray-800'
          }`}>
            <p className={`text-sm font-semibold mb-2 ${
              allOk ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-900 dark:text-amber-200'
            }`}>
              {allOk ? '✓ Week compleet — klaar om in te dienen' : 'Wat moet je nog doen voor deze week?'}
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {items.map((it) => (
                <li key={it.key}>
                  <button
                    onClick={() => setExpandedDay(it.dayIndex)}
                    className={`w-full text-left text-xs px-2 py-1 rounded transition-colors ${
                      it.ok
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 font-medium'
                    }`}
                  >
                    {it.ok ? '✓' : '✗'} {it.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* Days List - Collapsible */}
      <div className="space-y-2">
        {currentTimesheet.entries.map((entry, index) => {
          const isExpanded = expandedDay === index;
          const hasData = entry.regularHours > 0 || entry.travelKilometers > 0 || (entry.workActivities?.length || 0) > 0;
          // ITKnecht-import herkennen via gereserveerde notes-marker.
          // Handmatige invoer van "Riset" is geblokkeerd in updateEntry/
          // updateWorkActivity, dus deze marker is betrouwbaar.
          const isImported = !!entry.notes && /\briset\b/i.test(entry.notes);
          const dayLeave = getDayLeave(entry.date);
          const daySick = getDaySick(entry.date);
          const hasLeaveOrSick = dayLeave || daySick;

          const activityHours = (entry.workActivities || [])
            .filter(wa => !wa.isITKnechtImport)
            .reduce((sum, wa) => sum + (wa.hours || 0), 0);
          const totalDayHours = (entry.regularHours || 0) + activityHours;

          const meetsDailyTarget = totalDayHours >= 8;

          // Inline indicators op de collapsed card: monteur ziet vóór
          // openen al wat er ontbreekt.
          const dayOfWeek = entry.date.getDay();
          const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
          const autoStatusBadge = daySick ? 'sick' : dayLeave ? 'holiday' : null;
          const effectiveStatusBadge =
            autoStatusBadge || entry.dayStatus || (totalDayHours > 0 ? 'worked' : '');
          const missingStatus = !isWeekendDay && !effectiveStatusBadge && !isReadOnly;
          const missingEffort =
            !isWeekendDay &&
            effectiveStatusBadge === 'worked' &&
            totalDayHours > 0 &&
            totalDayHours < 8 &&
            !(entry.effortNote && entry.effortNote.trim()) &&
            !isReadOnly;

          return (
            <div key={index}>
              {/* Day Card - Collapsible Header */}
              <button
                onClick={() => setExpandedDay(isExpanded ? null : index)}
                disabled={isReadOnly && !hasData && !hasLeaveOrSick}
                className={`w-full p-3 sm:p-4 rounded-lg border-2 transition-all text-left flex items-center justify-between ${
                  isExpanded
                    ? 'border-primary-300 dark:border-primary-600 bg-primary-50 dark:!bg-gray-700'
                    : missingStatus
                    ? 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-gray-600'
                    : missingEffort
                    ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-gray-700 hover:bg-amber-100 dark:hover:bg-gray-600'
                    : daySick
                    ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-gray-600'
                    : dayLeave
                    ? 'border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-gray-700 hover:bg-emerald-100 dark:hover:bg-gray-600'
                    : hasData && meetsDailyTarget
                    ? 'border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-gray-700 hover:bg-emerald-100 dark:hover:bg-gray-600'
                    : hasData
                    ? 'border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-gray-700 hover:bg-orange-100 dark:hover:bg-gray-600'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100">
                      {getDayName(entry.date)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {entry.date.toLocaleDateString('nl-NL')}
                    </p>
                  </div>

                  {/* Quick Summary */}
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium flex-wrap justify-end">
                    {missingStatus && (
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
                        Status ontbreekt
                      </span>
                    )}
                    {missingEffort && (
                      <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs">
                        Toelichting ontbreekt
                      </span>
                    )}
                    {dayLeave && (
                      <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded flex items-center gap-1">
                        <Palmtree className="h-3 w-3" />
                        {getLeaveTypeLabel(dayLeave.type)}
                      </span>
                    )}
                    {daySick && (
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded flex items-center gap-1">
                        <HeartPulse className="h-3 w-3" />
                        Ziek {daySick.workCapacityPercentage > 0 ? `(${daySick.workCapacityPercentage}%)` : ''}
                      </span>
                    )}
                    {totalDayHours > 0 && (
                      <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                        {totalDayHours}u
                      </span>
                    )}
                    {entry.travelKilometers > 0 && (
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                        {entry.travelKilometers}km
                      </span>
                    )}
                    {isImported && (
                      <Download className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                    )}
                  </div>
                </div>

                <ChevronRight className={`h-5 w-5 text-gray-600 dark:text-gray-300 transition-transform flex-shrink-0 ml-2 ${isExpanded ? 'rotate-90' : ''}`} />
              </button>

              {/* Expanded Day Content */}
              {isExpanded && (
                <div className={`mt-1 rounded-xl shadow-md border hover:shadow-lg transition-shadow duration-200 dark:!bg-gray-800 ${
                  isImported
                    ? 'bg-primary-50 border-primary-200 dark:border-primary-700'
                    : daySick
                    ? 'bg-red-50 border-red-200 dark:border-red-700'
                    : dayLeave
                    ? 'bg-emerald-50 border-emerald-200 dark:border-emerald-700'
                    : 'bg-white border-gray-100 dark:border-gray-600'
                }`}>
                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                  {/* Verlof/Ziekte Details */}
                  {(dayLeave || daySick) && (
                    <div className={`p-3 rounded-lg ${daySick ? 'bg-red-100 dark:!bg-gray-700 border border-red-200 dark:border-red-700' : 'bg-emerald-100 dark:!bg-gray-700 border border-emerald-200 dark:border-emerald-700'}`}>
                      {dayLeave && (
                        <div className="flex items-start gap-2">
                          <Palmtree className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-emerald-800 dark:text-emerald-200">{getLeaveTypeLabel(dayLeave.type)}</p>
                            <p className="text-sm text-emerald-600 dark:text-emerald-400">
                              {new Date(dayLeave.startDate).toLocaleDateString('nl-NL')} - {new Date(dayLeave.endDate).toLocaleDateString('nl-NL')}
                            </p>
                            {dayLeave.reason && (
                              <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">{dayLeave.reason}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {daySick && (
                        <div className="flex items-start gap-2">
                          <HeartPulse className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-red-800 dark:text-red-200">
                              Ziekmelding {daySick.workCapacityPercentage > 0 ? `(${daySick.workCapacityPercentage}% werkzaam)` : '(volledig ziek)'}
                            </p>
                            <p className="text-sm text-red-600 dark:text-red-400">
                              Sinds {new Date(daySick.startDate).toLocaleDateString('nl-NL')}
                              {daySick.endDate && ` - ${new Date(daySick.endDate).toLocaleDateString('nl-NL')}`}
                            </p>
                            {daySick.status === 'long_term' && (
                              <p className="text-xs text-red-700 dark:text-red-300 mt-1 font-medium">Langdurig verzuim - Poortwachter actief</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {(() => {
                    // Zaterdag (6) en zondag (0) zijn niet verplicht — geen
                    // status-dropdown en geen effort-prompt. Werknemer kan
                    // wel gewoon uren voor weekenddienst invoeren.
                    const dayOfWeek = entry.date.getDay();
                    const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;

                    // Verlof en ziekte komen AUTOMATISCH uit die modules. Als er
                    // voor deze dag een leave/sick-record is, slaan we de dropdown
                    // over en tellen we de dag als ingevuld (met auto-status).
                    const autoStatus = daySick ? 'sick' : dayLeave ? 'holiday' : null;
                    const effectiveStatus =
                      autoStatus ||
                      entry.dayStatus ||
                      (totalDayHours > 0 ? 'worked' : '');
                    const isFilled = !!effectiveStatus;
                    const isWorked = effectiveStatus === 'worked';
                    // Effort-note alleen op werkdagen (ma-vr).
                    const needsEffortNote = !isWeekendDay && isWorked && totalDayHours > 0 && totalDayHours < 8;

                    // Weekend zonder uren/status → niks tonen, geen druk.
                    if (isWeekendDay && !entry.dayStatus && totalDayHours === 0 && !autoStatus) {
                      return null;
                    }
                    return (
                      <>
                        {autoStatus ? (
                          // Leave/sick = automatisch geregistreerd — laat zien dat
                          // het al gevuld is, geen keuze nodig.
                          <div className="mb-3 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:!bg-gray-900">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-200">
                              Status van de dag
                            </p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                              {autoStatus === 'sick' ? 'Ziek' : 'Verlof'}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-300 mt-0.5">
                              Automatisch geregistreerd via {autoStatus === 'sick' ? 'Ziekteverzuim' : 'Verlof'}-module.
                            </p>
                          </div>
                        ) : isImported ? (
                          // ITKnecht-import: status is automatisch 'Gewerkt'.
                          // Geen dropdown — maar eigen uren toevoegen is WEL mogelijk.
                          <div className="mb-3 p-3 rounded-lg border border-primary-300 dark:border-primary-700 bg-primary-50 dark:!bg-gray-700">
                            <p className="text-xs font-medium text-primary-700 dark:text-primary-300">
                              Status van de dag
                            </p>
                            <p className="text-sm font-semibold text-primary-900 dark:text-primary-200 mt-0.5">
                              Productie uren Riset
                            </p>
                            <p className="text-[11px] text-primary-600 dark:text-primary-400 mt-0.5">
                              Automatisch geïmporteerd via ITKnecht. U kunt eigen uren toevoegen via de knop hieronder.
                            </p>
                          </div>
                        ) : (
                          <div className="mb-3">
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                              Status van de dag <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={effectiveStatus}
                              onChange={(e) => {
                                const newStatus = e.target.value;
                                updateEntry(index, 'dayStatus' as any, newStatus);
                                // Bij niet-gewerkt uren leegmaken — behalve bij
                                // 'partial_work' (half werk = wel uren mogelijk).
                                if (newStatus && newStatus !== 'worked' && newStatus !== 'partial_work') {
                                  if (entry.regularHours > 0) updateEntry(index, 'regularHours', 0);
                                }
                              }}
                              disabled={isReadOnly}
                              className={`w-full px-3 py-2 rounded-lg border text-sm font-medium bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${
                                isFilled
                                  ? 'border-gray-300 dark:border-gray-600'
                                  : 'border-amber-400 dark:border-amber-600 ring-1 ring-amber-200 dark:ring-amber-900/40'
                              } disabled:opacity-60`}
                            >
                              <option value="">— Kies een status —</option>
                              <option value="worked">Gewerkt</option>
                              <option value="partial_work">Geen / half werk uitgevoerd</option>
                              <option value="unpaid">Onbetaald afwezig</option>
                              <option value="meeting">Overleg / training</option>
                              <option value="holiday_public">Feestdag</option>
                            </select>
                            {!isFilled && (
                              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                                Verplicht om aan te geven voordat de week ingediend kan worden.
                                Verlof of ziek? Registreer dat via de aparte modules.
                              </p>
                            )}
                          </div>
                        )}

                        {/* Reden bij niet-gewerkt (alleen voor handmatige statussen) */}
                        {!autoStatus && isFilled && !isWorked && (
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                              Korte toelichting (optioneel)
                            </label>
                            <Input
                              type="text"
                              value={entry.statusReason || ''}
                              onChange={(e) => updateEntry(index, 'statusReason' as any, e.target.value)}
                              disabled={isReadOnly}
                              placeholder="Bv. training, meeting, administratie..."
                            />
                          </div>
                        )}

                        {/* Verplichte effort-toelichting bij gewerkt < 8u */}
                        {needsEffortNote && (
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                              Minder dan 8 uur gewerkt — wat heb je gedaan? <span className="text-red-500">*</span>
                            </label>
                            <Input
                              type="text"
                              value={entry.effortNote || ''}
                              onChange={(e) => updateEntry(index, 'effortNote' as any, e.target.value)}
                              disabled={isReadOnly}
                              placeholder="Bv. kantoor gebeld/geappt, administratie bijgewerkt, klant contact..."
                              className={entry.effortNote ? '' : 'border-amber-400 dark:border-amber-600'}
                            />
                            {!entry.effortNote && (
                              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                                Vereist: welke effort heb je geleverd om toch bij te dragen?
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Input Fields — alleen relevant als 'Gewerkt' */}
                  {(() => {
                    const kmDisabled = isReadOnly || (!!entry.dayStatus && entry.dayStatus !== 'worked' && entry.dayStatus !== 'partial_work');
                    const base = assignedVehicle?.currentMileage;
                    const chained = typeof base === 'number';
                    // Beginstand: gebruik de OPGESLAGEN dagwaarde als die er is
                    // (zo blijft een ingediende/herladen week stabiel), anders
                    // afleiden uit de eindstand van de vorige dag, anders de
                    // auto-tellerstand. Bij gekoppelde auto is dit read-only.
                    let liveBegin: number | undefined =
                      typeof entry.startKilometers === 'number'
                        ? entry.startKilometers
                        : (chained ? (base as number) : undefined);
                    if (typeof entry.startKilometers !== 'number' && chained && currentTimesheet) {
                      for (let j = index - 1; j >= 0; j--) {
                        const pe = currentTimesheet.entries[j];
                        if (typeof pe.endKilometers === 'number') { liveBegin = pe.endKilometers; break; }
                      }
                    }
                    const dayKm = chained
                      ? (typeof entry.endKilometers === 'number' && typeof liveBegin === 'number' && entry.endKilometers >= liveBegin
                          ? entry.endKilometers - liveBegin
                          : 0)
                      : (entry.travelKilometers || 0);
                    const negative = chained
                      ? (typeof entry.endKilometers === 'number' && typeof liveBegin === 'number' && entry.endKilometers < liveBegin)
                      : (typeof entry.startKilometers === 'number' && typeof entry.endKilometers === 'number' && entry.endKilometers < entry.startKilometers);
                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Uren</label>
                            <Input
                              type="number"
                              min="0"
                              max="24"
                              step="0.5"
                              value={entry.regularHours}
                              onChange={(e) => updateEntry(index, 'regularHours', parseFloat(e.target.value) || 0)}
                              disabled={isReadOnly || isImported || (!!entry.dayStatus && entry.dayStatus !== 'worked' && entry.dayStatus !== 'partial_work')}
                              className="text-center font-semibold text-lg"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                              Dagkilometers (automatisch)
                            </label>
                            <div className="h-[46px] flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 font-semibold text-lg text-gray-900 dark:text-gray-100">
                              {dayKm} km
                            </div>
                          </div>
                        </div>

                        {/* KM-standen — beginstand (auto bij gekoppelde auto) → eindstand */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">
                              Kilometerstand (begin → eind)
                            </label>
                            {assignedVehicle && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium">
                                {assignedVehicle.kenteken}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {chained ? (
                              <div>
                                <div className="h-[46px] flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-center text-gray-700 dark:text-gray-200">
                                  {typeof liveBegin === 'number' ? `${liveBegin}` : '—'}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-0.5 text-center">Beginstand (automatisch)</p>
                              </div>
                            ) : (
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={entry.startKilometers ?? ''}
                                onChange={(e) => updateEntry(index, 'startKilometers', e.target.value === '' ? (undefined as any) : (parseInt(e.target.value, 10) || 0))}
                                disabled={kmDisabled}
                                className="text-center"
                                placeholder="Beginstand"
                              />
                            )}
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={entry.endKilometers ?? ''}
                              onChange={(e) => updateEntry(index, 'endKilometers', e.target.value === '' ? (undefined as any) : (parseInt(e.target.value, 10) || 0))}
                              disabled={kmDisabled}
                              className="text-center"
                              placeholder="Eindstand"
                            />
                          </div>
                          {negative && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                              Eindstand mag niet lager zijn dan de beginstand ({liveBegin} km).
                            </p>
                          )}
                          {chained && (
                            <p className="text-[11px] text-gray-400 mt-1">
                              Je vult alleen de eindstand in — morgen begint automatisch op deze stand.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Notes */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Notities</label>
                    <Input
                      type="text"
                      value={entry.notes || ''}
                      onChange={(e) => updateEntry(index, 'notes', e.target.value)}
                      disabled={isReadOnly || isImported}
                      placeholder={isImported ? 'Automatisch geïmporteerd' : 'Notities of opmerkingen...'}
                      className="text-sm"
                    />
                  </div>

                  {/* Work Activities */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">Werkzaamheden</label>
                      {!isReadOnly && (
                        <Button
                          onClick={() => addWorkActivity(index)}
                          size="sm"
                          variant="secondary"
                          className="text-xs"
                        >
                          + Toevoegen
                        </Button>
                      )}
                    </div>

                    {(entry.workActivities || []).map((activity, actIdx) => {
                      const colorMeta = getProjectColorMeta(
                        internalProjects.find(p => p.id === activity.internalProjectId)?.color
                      );
                      return (
                        <div key={actIdx} className={`p-2 rounded space-y-1.5 ${activity.isITKnechtImport ? 'bg-primary-100 dark:bg-primary-900/50' : 'bg-gray-100 dark:bg-gray-800'}`}>
                          {/* Project selector — alleen voor handmatige entries */}
                          {!activity.isITKnechtImport && !isReadOnly && internalProjects.length > 0 && (
                            <div className="flex items-center gap-2">
                              <FolderKanban className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              <select
                                value={activity.internalProjectId || ''}
                                onChange={e => selectProjectForActivity(index, actIdx, e.target.value)}
                                className="flex-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-1 px-1.5"
                              >
                                <option value="">— Kies project (optioneel) —</option>
                                {internalProjects.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {/* Taak-selector: verschijnt altijd als er taken beschikbaar zijn */}
                          {!activity.isITKnechtImport && !isReadOnly && (() => {
                            const relevantTasks = activity.internalProjectId
                              ? assignedTasks.filter(
                                  t => t.internalProjectId === activity.internalProjectId &&
                                       t.status !== 'completed' && t.status !== 'cancelled'
                                )
                              : assignedTasks.filter(
                                  t => t.status !== 'completed' && t.status !== 'cancelled'
                                );
                            if (relevantTasks.length === 0) return null;
                            return (
                              <div className="flex items-center gap-2">
                                <ListChecks className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                <select
                                  value={activity.taskId || ''}
                                  onChange={e => selectTaskForActivity(index, actIdx, e.target.value)}
                                  className="flex-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-1 px-1.5"
                                >
                                  <option value="">— Kies taak (optioneel) —</option>
                                  {relevantTasks.map(t => (
                                    <option key={t.id} value={t.id}>
                                      {t.title}{t.estimatedHours ? ` (~${t.estimatedHours}u)` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })()}

                          {/* Project badge in readonly modus */}
                          {activity.internalProjectName && (isReadOnly || activity.isITKnechtImport) && (
                            <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${colorMeta.bg} ${colorMeta.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${colorMeta.dot}`} />
                              {activity.internalProjectName}
                            </div>
                          )}
                          <div className="flex gap-2 items-center">
                            <Input
                              type="number"
                              min="0"
                              max="24"
                              step="0.5"
                              value={activity.hours}
                              onChange={(e) => updateWorkActivity(index, actIdx, 'hours', parseFloat(e.target.value) || 0)}
                              disabled={isReadOnly || activity.isITKnechtImport}
                              className="w-16 text-center text-xs py-1"
                              placeholder="0u"
                            />
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={activity.kilometers ?? ''}
                              onChange={(e) => updateWorkActivity(index, actIdx, 'kilometers', e.target.value === '' ? (undefined as any) : (parseInt(e.target.value, 10) || 0))}
                              disabled={isReadOnly || activity.isITKnechtImport}
                              className="w-16 text-center text-xs py-1"
                              placeholder="km"
                              title="Kilometers voor deze rit (bv. wasstraat)"
                            />
                            <Input
                              type="text"
                              value={activity.description}
                              onChange={(e) => updateWorkActivity(index, actIdx, 'description', e.target.value)}
                              disabled={isReadOnly || activity.isITKnechtImport}
                              placeholder="Beschrijving..."
                              className="flex-1 text-xs py-1"
                            />
                            {!isReadOnly && !activity.isITKnechtImport && (
                              <button
                                onClick={() => removeWorkActivity(index, actIdx)}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-bold text-lg"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons + missingItems-info (informatief; de submit-flow
          handelt validatie zelf af — onder 40u opent automatisch het
          review-modal in handleSubmit). */}
      {!isReadOnly && (() => {
        const missing: Array<{
          key: string;
          label: string;
          dayIndex: number;
        }> = [];

        currentTimesheet.entries.forEach((e, idx) => {
          const dow = new Date(e.date).getDay();
          const isWeekend = dow === 0 || dow === 6;
          if (isWeekend) return;

          const dayLeave = getDayLeave(e.date);
          const daySick = getDaySick(e.date);
          const autoStatus = daySick ? 'sick' : dayLeave ? 'holiday' : null;
          const effective = autoStatus || e.dayStatus || (e.regularHours > 0 ? 'worked' : '');
          const dayLabel = new Date(e.date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' });

          if (!effective) {
            missing.push({
              key: `status-${idx}`,
              label: `${dayLabel}: status van de dag ontbreekt`,
              dayIndex: idx,
            });
          } else if (
            effective === 'worked' &&
            (e.regularHours || 0) > 0 &&
            (e.regularHours || 0) < 8 &&
            !(e.effortNote && e.effortNote.trim())
          ) {
            missing.push({
              key: `effort-${idx}`,
              label: `${dayLabel}: minder dan 8u gewerkt — toelichting ontbreekt`,
              dayIndex: idx,
            });
          }
        });

        return (
          <>
            <div className="flex gap-2 sm:gap-3">
              <Button
                onClick={handleSave}
                disabled={saving}
                variant="secondary"
                className="flex-1 sm:flex-none"
              >
                <Save className="h-4 w-4 mr-2" />
                Opslaan
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !currentTimesheet.id}
                className="flex-1"
              >
                <Send className="h-4 w-4 mr-2" />
                Indienen
              </Button>
            </div>

            {missing.length > 0 && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-gray-700 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold">{missing.length}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      Nog {missing.length} {missing.length === 1 ? 'punt' : 'punten'} open
                    </p>
                    <ul className="mt-2 space-y-1">
                      {missing.map((m) => (
                        <li key={m.key}>
                          <button
                            onClick={() => setExpandedDay(m.dayIndex)}
                            className="text-left text-xs text-amber-800 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
                          >
                            • {m.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Low-hours review modal: <40u in een week → 3 verplichte vragen */}
      {showLowHoursModal && currentTimesheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Minder dan 40 uur deze week
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                Je hebt <strong>{currentTimesheet.totalRegularHours}u</strong> geregistreerd. Voordat je
                kan indienen willen we 3 dingen van je weten — niet om je te pesten,
                maar om samen beter te worden.
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  1. Is er dagelijks contact geweest met kantoor? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reviewAnswers.dailyContact}
                  onChange={(e) => setReviewAnswers({ ...reviewAnswers, dailyContact: e.target.value })}
                  rows={2}
                  placeholder="Bv. elke ochtend kort gebeld met collega X over de planning..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  2. Heb jij zelf alle effort erin gestoken om effectief te zijn? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reviewAnswers.effortInvested}
                  onChange={(e) => setReviewAnswers({ ...reviewAnswers, effortInvested: e.target.value })}
                  rows={2}
                  placeholder="Wat heb je concreet gedaan om waarde toe te voegen?"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  3. Welke suggesties heb je om jouw tijd effectiever te maken — voor jezelf én voor het bedrijf? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reviewAnswers.suggestions}
                  onChange={(e) => setReviewAnswers({ ...reviewAnswers, suggestions: e.target.value })}
                  rows={3}
                  placeholder="Bv. betere planning door X, andere tools, training, klus-overleg..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Soft-check: opdrachtgever-blame in vraag 3 → extra zelfreflectie. */}
              {containsOpdrachtgeverBlame(reviewAnswers.suggestions) && (
                <div>
                  <div className="mb-1 p-2 rounded-md bg-amber-50 dark:bg-gray-700 border border-amber-200 dark:border-amber-700 text-[11px] text-amber-800 dark:text-amber-200">
                    Je verwijst naar een opdrachtgever. Dat mag, maar focus ook op wat <strong>jij of het team</strong> zelf kunnen veranderen — daar heb je invloed op.
                  </div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">
                    3b. Los van wat opdrachtgevers leveren — wat kun jij of het team zelf doen om beter bij te dragen? <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reviewAnswers.suggestionsSelf}
                    onChange={(e) => setReviewAnswers({ ...reviewAnswers, suggestionsSelf: e.target.value })}
                    rows={3}
                    placeholder="Bv. proactief klanten bellen, eigen administratie verbeteren, collega's helpen, training oppakken..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <Button
                onClick={() => setShowLowHoursModal(false)}
                variant="secondary"
                className="flex-1"
              >
                Annuleren
              </Button>
              <Button
                onClick={handleLowHoursReviewSubmit}
                loading={saving}
                className="flex-1"
              >
                <Send className="h-4 w-4 mr-2" />
                Review + Indienen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}