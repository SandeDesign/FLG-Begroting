import React, { useEffect, useState, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { subscribeTasksAssignedToUser, updateTask } from '../../services/firebase';
import { computeTaskCompletionPatch } from '../../utils/taskCompletion';
import { isTaskOverdue } from '../../utils/taskDeadline';
import { BusinessTask } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { CalendarDays, CheckCircle2, AlertCircle, Sun, Repeat, ArrowRight, ListChecks } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';

export interface WeeklyTasksReminderRef {
  openManually: () => void;
}

interface WeeklyTasksReminderProps {
  employeeId?: string;
}

const getWeekStart = (date: Date): Date => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // 0 = maandag
  d.setDate(d.getDate() - day);
  return d;
};

const WeeklyTasksReminder = forwardRef<WeeklyTasksReminderRef, WeeklyTasksReminderProps>(({ employeeId }, ref) => {
  const { user, userRole } = useAuth();
  const { currentEmployeeId } = useApp();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const [showReminder, setShowReminder] = useState(false);
  const [allTasks, setAllTasks] = useState<BusinessTask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const autoShownRef = useRef(false);

  // Eigen identiteit(en) — alleen taken van het eigen account.
  const myIds = useMemo(
    () => [currentEmployeeId || '', employeeId || '', user?.uid || ''].filter(Boolean),
    [currentEmployeeId, employeeId, user?.uid]
  );

  const selfIdFor = (task: BusinessTask): string => {
    const assigned = task.assignedTo || [];
    const match = myIds.find(id => assigned.includes(id));
    return match || myIds[0] || '';
  };

  useEffect(() => {
    if (!user || myIds.length === 0) return;
    const unsub = subscribeTasksAssignedToUser(myIds, (tasks) => {
      setAllTasks(tasks);
      setLoaded(true);
    });
    return () => unsub();
  }, [user, myIds.join(',')]);

  // Taken voor deze week: openstaand én (te laat OF deze week vervallend).
  const weekTasks = useMemo(() => {
    const today = new Date();
    const weekStart = getWeekStart(today);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return allTasks
      .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
      .filter(t => {
        const due = new Date(t.dueDate);
        return isTaskOverdue(t) || (due >= weekStart && due < weekEnd);
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [allTasks]);

  // Auto-tonen bij inloggen (1x per dag).
  useEffect(() => {
    if (!loaded || autoShownRef.current || !user) return;
    if (weekTasks.length === 0) return;
    const todayKey = new Date().toISOString().split('T')[0];
    if (localStorage.getItem(`tasksReminder_${user.uid}`) === todayKey) return;
    autoShownRef.current = true;
    setShowReminder(true);
  }, [loaded, weekTasks, user]);

  useImperativeHandle(ref, () => ({
    openManually: () => setShowReminder(true),
  }));

  const handleClose = () => {
    if (user) {
      const todayKey = new Date().toISOString().split('T')[0];
      localStorage.setItem(`tasksReminder_${user.uid}`, todayKey);
    }
    setShowReminder(false);
  };

  const handleViewAll = () => {
    handleClose();
    navigate(userRole === 'employee' ? '/employee-dashboard/tasks' : userRole === 'manager' ? '/my-tasks' : '/tasks');
  };

  const handleComplete = async (task: BusinessTask) => {
    if (!user) return;
    setCompleting(prev => new Set(prev).add(task.id));
    try {
      const selfId = selfIdFor(task);
      await updateTask(task.id, selfId, computeTaskCompletionPatch(task, selfId, true));
      success('Taak voltooid!', task.title);
    } catch (err) {
      console.error('Error completing task:', err);
      showError('Fout', 'Kon taak niet voltooien');
    } finally {
      setCompleting(prev => { const n = new Set(prev); n.delete(task.id); return n; });
    }
  };

  const isToday = (task: BusinessTask): boolean => {
    const t = new Date();
    const d = new Date(task.dueDate);
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };

  const fmt = (date: Date) => new Date(date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });

  if (!showReminder || weekTasks.length === 0) return null;

  const overdue = weekTasks.filter(t => isTaskOverdue(t));
  const todayTasks = weekTasks.filter(t => !isTaskOverdue(t) && isToday(t));
  const upcoming = weekTasks.filter(t => !isTaskOverdue(t) && !isToday(t));

  const firstName = (user?.displayName || user?.email || '').split(/[ @]/)[0];

  const Chip: React.FC<{ count: number; label: string; tone: string }> = ({ count, label, tone }) =>
    count > 0 ? (
      <div className={`flex-1 rounded-xl px-3 py-2 text-center ${tone}`}>
        <div className="text-xl font-bold leading-none">{count}</div>
        <div className="text-[11px] font-medium mt-1 opacity-80">{label}</div>
      </div>
    ) : null;

  const TaskRow: React.FC<{ task: BusinessTask; accent: string }> = ({ task, accent }) => {
    const busy = completing.has(task.id);
    const overdueRow = isTaskOverdue(task);
    return (
      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
        <button
          onClick={() => handleComplete(task)}
          disabled={busy}
          title="Markeer als gedaan"
          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 ${accent} flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors`}
        >
          {busy && <CheckCircle2 className="h-4 w-4 text-green-600" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs ${overdueRow ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
              {isToday(task) ? 'Vandaag · vóór 17:00' : fmt(task.dueDate)}
            </span>
            {task.isRecurring && <Repeat className="h-3 w-3 text-purple-500" />}
            {task.checklist && task.checklist.length > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-gray-400">
                <ListChecks className="h-3 w-3" />{task.checklist.filter(s => s.completed).length}/{task.checklist.length}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={showReminder} onClose={handleClose} title="" size="lg">
      <div className="space-y-5">
        {/* Hero */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary-100 dark:bg-primary-900/40">
            <CalendarDays className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {firstName ? `Hoi ${firstName}!` : 'Jouw taken'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Je hebt {weekTasks.length} {weekTasks.length === 1 ? 'taak' : 'taken'} op je naam deze week.
            </p>
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex gap-2">
          <Chip count={overdue.length} label="Te laat" tone="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400" />
          <Chip count={todayTasks.length} label="Vandaag" tone="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" />
          <Chip count={upcoming.length} label="Binnenkort" tone="bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400" />
        </div>

        <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
          {overdue.length > 0 && (
            <section>
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-2">
                <AlertCircle className="h-4 w-4" /> Te laat
              </h4>
              <div className="space-y-2">{overdue.map(t => <TaskRow key={t.id} task={t} accent="border-red-300 dark:border-red-700" />)}</div>
            </section>
          )}
          {todayTasks.length > 0 && (
            <section>
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-2">
                <Sun className="h-4 w-4" /> Vandaag
              </h4>
              <div className="space-y-2">{todayTasks.map(t => <TaskRow key={t.id} task={t} accent="border-amber-300 dark:border-amber-700" />)}</div>
            </section>
          )}
          {upcoming.length > 0 && (
            <section>
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400 mb-2">
                <CalendarDays className="h-4 w-4" /> Binnenkort
              </h4>
              <div className="space-y-2">{upcoming.map(t => <TaskRow key={t.id} task={t} accent="border-sky-300 dark:border-sky-700" />)}</div>
            </section>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">Later</Button>
          <Button onClick={handleViewAll} icon={ArrowRight} className="flex-1">Naar mijn taken</Button>
        </div>
      </div>
    </Modal>
  );
});

WeeklyTasksReminder.displayName = 'WeeklyTasksReminder';

export default WeeklyTasksReminder;
