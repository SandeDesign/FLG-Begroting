import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  Repeat,
  CheckCircle2,
  Circle,
  Lock,
  CalendarPlus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useToast } from '../hooks/useToast';
import { BusinessTask } from '../types';
import {
  subscribeTasksAssignedToUser,
  scheduleTask,
  unscheduleTask,
  updateTask,
  generateRecurringTasks,
} from '../services/firebase';
import { checkAndShowSchedulingReminders } from '../services/taskSchedulingService';
import { PRIORITY_CONFIG, FREQUENCY_LABELS } from '../utils/taskConfig';
import { computeTaskCompletionPatch } from '../utils/taskCompletion';
import ScheduledTaskPopover from '../components/tasks/ScheduledTaskPopover';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

const DAY_NAMES = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag'];
const DAY_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];

const startOfWeek = (date: Date): Date => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // 0 = maandag
  d.setDate(d.getDate() - day);
  return d;
};

const addDays = (date: Date, n: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const sameDay = (a: Date | undefined, b: Date): boolean => {
  if (!a) return false;
  const d = new Date(a);
  return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate();
};

const priorityColor = (task: BusinessTask): string =>
  task.priority === 'urgent' ? '#ef4444'
    : task.priority === 'high' ? '#f97316'
    : task.priority === 'medium' ? '#3b82f6'
    : '#6b7280';

const EmployeeAgenda: React.FC = () => {
  const { user, adminUserId } = useAuth();
  const { currentEmployeeId } = useApp();
  const { success, error } = useToast();
  usePageTitle('Mijn Agenda');

  const [loading, setLoading] = useState(true);
  const [allTasks, setAllTasks] = useState<BusinessTask[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [selectedPoolTask, setSelectedPoolTask] = useState<BusinessTask | null>(null);
  const [selectedTask, setSelectedTask] = useState<BusinessTask | null>(null);
  const [schedulingReminder, setSchedulingReminder] = useState<{ level: string; count: number } | null>(null);

  // Inplan-modal (dag + tijdslot)
  const [schedulingTask, setSchedulingTask] = useState<BusinessTask | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('09:00');
  const [scheduleEndTime, setScheduleEndTime] = useState('10:00');

  // Identiteit die in assignedTo staat (employee doc-ID of auth-UID).
  const selfIdFor = (task: BusinessTask): string => {
    const assigned = task.assignedTo || [];
    if (currentEmployeeId && assigned.includes(currentEmployeeId)) return currentEmployeeId;
    if (user && assigned.includes(user.uid)) return user.uid;
    return currentEmployeeId || user?.uid || '';
  };

  // Realtime taken — persoonlijk, ongeacht bedrijf.
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    if (adminUserId) {
      generateRecurringTasks(adminUserId).catch(() => {});
    }
    const ids = [currentEmployeeId || '', user.uid].filter(Boolean);
    const unsub = subscribeTasksAssignedToUser(
      ids,
      (tasks) => { setAllTasks(tasks); setLoading(false); },
      (err) => { console.error('[Agenda] load error:', err); error('Fout bij laden van taken'); setLoading(false); }
    );
    return () => unsub();
  }, [user, currentEmployeeId, adminUserId]);

  useEffect(() => {
    const run = async () => {
      if (!user || !adminUserId) return;
      try {
        const result = await checkAndShowSchedulingReminders(adminUserId, user.uid);
        if (result) setSchedulingReminder({ level: result.level, count: result.unscheduledCount });
      } catch { /* stil */ }
    };
    run();
  }, [user, adminUserId]);

  const isActive = (t: BusinessTask) => t.status !== 'completed' && t.status !== 'cancelled';
  const isFlexible = (t: BusinessTask) => t.schedulingType === 'flexible';

  // "Te plannen": flexibele, nog niet ingeplande, niet-voltooide taken.
  const poolTasks = allTasks.filter(t => isFlexible(t) && !t.isScheduled && isActive(t));

  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  // Taken per dag: vaste taken op dueDate + flexibele ingeplande taken op scheduledDate.
  const tasksForDay = (day: Date): BusinessTask[] => {
    const fixed = allTasks.filter(t => !isFlexible(t) && t.status !== 'cancelled' && sameDay(t.dueDate, day));
    const flex = allTasks.filter(t => isFlexible(t) && t.isScheduled && t.status !== 'cancelled' && sameDay(t.scheduledDate, day));
    return [...fixed, ...flex].sort((a, b) => (a.scheduledStartTime || '99:99').localeCompare(b.scheduledStartTime || '99:99'));
  };

  const openScheduleModal = (task: BusinessTask, day: Date) => {
    const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const endHour = task.estimatedHours ? Math.min(9 + Math.floor(task.estimatedHours), 22) : 10;
    const endMinute = task.estimatedHours ? Math.round((task.estimatedHours % 1) * 60) : 0;
    setScheduleDate(dateStr);
    setScheduleStartTime('09:00');
    setScheduleEndTime(`${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`);
    setSchedulingTask(task);
  };

  const handleDayClick = (day: Date) => {
    if (!selectedPoolTask) return;
    openScheduleModal(selectedPoolTask, day);
    setSelectedPoolTask(null);
  };

  const handleScheduleSubmit = async () => {
    if (!schedulingTask || !scheduleDate) return;
    try {
      const dateObj = new Date(`${scheduleDate}T${scheduleStartTime}:00`);
      await scheduleTask(schedulingTask.id, selfIdFor(schedulingTask), dateObj, scheduleStartTime, scheduleEndTime);
      setSchedulingTask(null);
      success('Taak ingepland');
    } catch (err) {
      console.error('Error scheduling task:', err);
      error('Fout bij inplannen van taak');
    }
  };

  const handleUnschedule = async (taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    try {
      await unscheduleTask(taskId, selfIdFor(task));
      setSelectedTask(null);
      success('Terug naar te plannen');
    } catch (err) {
      console.error(err);
      error('Fout bij herplannen');
    }
  };

  const handleComplete = async (taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    try {
      const selfId = selfIdFor(task);
      await updateTask(taskId, selfId, computeTaskCompletionPatch(task, selfId, true));
      setSelectedTask(null);
      success('Taak voltooid');
    } catch (err) {
      console.error(err);
      error('Fout bij voltooien');
    }
  };

  const weekLabel = `${weekStart.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} – ${addDays(weekStart, 4).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;
  }

  const TaskChip: React.FC<{ task: BusinessTask }> = ({ task }) => {
    const done = task.status === 'completed';
    const locked = !isFlexible(task);
    return (
      <button
        onClick={() => setSelectedTask(task)}
        className={`w-full text-left rounded-lg border px-2 py-1.5 transition-colors ${
          done
            ? 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 opacity-70'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-sm'
        }`}
      >
        <div className="flex items-start gap-1.5">
          <span className="mt-1 h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: priorityColor(task) }} />
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-medium truncate ${done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
              {task.title}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {task.scheduledStartTime && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                  <Clock className="h-2.5 w-2.5" />{task.scheduledStartTime}
                </span>
              )}
              {locked && <Lock className="h-2.5 w-2.5 text-gray-400 dark:text-gray-500" />}
              {task.isRecurring && <Repeat className="h-2.5 w-2.5 text-purple-500" />}
              {done && <CheckCircle2 className="h-2.5 w-2.5 text-green-600" />}
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mijn Agenda</h1>
          <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
            {poolTasks.length > 0 ? `${poolTasks.length} ${poolTasks.length === 1 ? 'taak' : 'taken'} nog in te plannen` : 'Alles ingepland'}
          </p>
        </div>
        {/* Weeknavigatie */}
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekStart(w => addDays(w, -7))} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
            {weekLabel}
          </button>
          <button onClick={() => setWeekStart(w => addDays(w, 7))} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scheduling reminder banner */}
      {schedulingReminder && poolTasks.length > 0 && (
        <div className={`rounded-lg p-3 flex items-center gap-3 ${
          schedulingReminder.level === 'overdue' ? 'bg-red-50 dark:bg-gray-700 border border-red-200 dark:border-red-800'
            : schedulingReminder.level === 'strong' ? 'bg-amber-50 dark:bg-gray-700 border border-amber-200 dark:border-amber-800'
            : 'bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-blue-800'
        }`}>
          <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${schedulingReminder.level === 'overdue' ? 'text-red-600' : schedulingReminder.level === 'strong' ? 'text-amber-600' : 'text-blue-600'}`} />
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Plan je taken in voor vrijdag 19:00 ({poolTasks.length} open).
          </p>
        </div>
      )}

      {/* Selectie-hint */}
      {selectedPoolTask && (
        <div className="rounded-lg p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-primary-800 dark:text-primary-300">
            <CalendarPlus className="h-4 w-4 inline mr-1.5" />
            Kies een dag voor "{selectedPoolTask.title}"
          </p>
          <button onClick={() => setSelectedPoolTask(null)} className="text-xs font-medium text-primary-700 dark:text-primary-400 hover:underline">
            Annuleren
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Te plannen-paneel */}
        <Card className="lg:col-span-1 !p-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Te plannen ({poolTasks.length})</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">Klik een taak en daarna een dag.</p>
          {poolTasks.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">Niets in te plannen 🎉</p>
          ) : (
            <div className="space-y-1.5">
              {poolTasks.map(task => {
                const selected = selectedPoolTask?.id === task.id;
                return (
                  <button
                    key={task.id}
                    onClick={() => setSelectedPoolTask(selected ? null : task)}
                    className={`w-full text-left rounded-lg border px-2.5 py-2 transition-colors ${
                      selected
                        ? 'border-primary-500 bg-primary-50 dark:bg-gray-700 ring-1 ring-primary-500'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="mt-1 h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: priorityColor(task) }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{task.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITY_CONFIG[task.priority].color}`}>
                            {PRIORITY_CONFIG[task.priority].label}
                          </span>
                          {task.isRecurring && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-purple-600 dark:text-purple-400">
                              <Repeat className="h-2.5 w-2.5" />{FREQUENCY_LABELS[task.frequency || 'weekly']}
                            </span>
                          )}
                          {task.estimatedHours && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                              <Clock className="h-2.5 w-2.5" />~{task.estimatedHours}u
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Weekgrid Ma–Vr */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {weekDays.map((day, i) => {
            const dayTasks = tasksForDay(day);
            const isToday = sameDay(day, today);
            const canPlace = !!selectedPoolTask;
            return (
              <div
                key={i}
                className={`rounded-xl border ${isToday ? 'border-primary-300 dark:border-primary-700' : 'border-gray-200 dark:border-gray-700'} bg-gray-50 dark:bg-gray-800/40 flex flex-col min-h-[140px]`}
              >
                <div className={`px-2.5 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between ${isToday ? 'bg-primary-50 dark:bg-primary-900/20 rounded-t-xl' : ''}`}>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                    <span className="lg:hidden">{DAY_NAMES[i]}</span>
                    <span className="hidden lg:inline">{DAY_SHORT[i]}</span>
                  </span>
                  <span className={`text-xs ${isToday ? 'font-bold text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    {day.getDate()}
                  </span>
                </div>
                <div className="p-1.5 space-y-1.5 flex-1">
                  {canPlace && (
                    <button
                      onClick={() => handleDayClick(day)}
                      className="w-full flex items-center justify-center gap-1 rounded-lg border border-dashed border-primary-400 dark:border-primary-600 text-primary-600 dark:text-primary-400 text-[11px] font-medium py-1.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    >
                      <CalendarPlus className="h-3 w-3" /> Plan hier
                    </button>
                  )}
                  {dayTasks.length === 0 && !canPlace && (
                    <div className="flex items-center justify-center h-16 text-[11px] text-gray-300 dark:text-gray-600">
                      <Circle className="h-3 w-3" />
                    </div>
                  )}
                  {dayTasks.map(task => <TaskChip key={task.id} task={task} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inplan-modal (dag + tijdslot) */}
      {schedulingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSchedulingTask(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{schedulingTask.title}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Datum</label>
                <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Begintijd</label>
                  <input type="time" value={scheduleStartTime} onChange={(e) => setScheduleStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Eindtijd</label>
                  <input type="time" value={scheduleEndTime} onChange={(e) => setScheduleEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setSchedulingTask(null)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Annuleren</button>
              <button onClick={handleScheduleSubmit} disabled={!scheduleDate} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg transition-colors">Inplannen</button>
            </div>
          </div>
        </div>
      )}

      {/* Taakdetail / afvinken */}
      {selectedTask && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedTask(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <ScheduledTaskPopover
              task={selectedTask}
              onClose={() => setSelectedTask(null)}
              onUnschedule={isFlexible(selectedTask) && selectedTask.isScheduled ? handleUnschedule : undefined}
              onStatusChange={(taskId) => handleComplete(taskId)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeAgenda;
