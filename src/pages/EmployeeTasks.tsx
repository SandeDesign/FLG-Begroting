import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  Calendar,
  ListChecks,
  Repeat,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  CalendarDays,
  AlertCircle,
  Sun,
  CalendarRange,
  Clock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { BusinessTask, TaskStatus } from '../types';
import { subscribeTasksAssignedToUser, updateTask } from '../services/firebase';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import { usePageTitle } from '../contexts/PageTitleContext';
import { CATEGORY_CONFIG, PRIORITY_CONFIG, STATUS_CONFIG, FREQUENCY_LABELS } from '../utils/taskConfig';
import { computeTaskCompletionPatch } from '../utils/taskCompletion';

type EmployeeTaskView = 'active' | 'done';
type ActiveBucket = 'overdue' | 'today' | 'week' | 'later' | 'recurring';

const EmployeeTasks: React.FC = () => {
  const { user, userRole } = useAuth();
  const { currentEmployeeId } = useApp();
  const { success, error } = useToast();
  usePageTitle('Mijn Taken');

  const [tasks, setTasks] = useState<BusinessTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<EmployeeTaskView>('active');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Realtime: toon alle aan deze gebruiker toegewezen taken, ongeacht het
  // geselecteerde bedrijf. Matcht op employee doc-ID én auth-UID zodat taken
  // altijd zichtbaar zijn ongeacht de id-ruimte waarin ze zijn toegewezen.
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const ids = [currentEmployeeId || '', user.uid].filter(Boolean);
    const unsub = subscribeTasksAssignedToUser(
      ids,
      (assignedTasks) => {
        setTasks(assignedTasks);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading tasks:', err);
        error('Fout', 'Kon taken niet laden');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user, currentEmployeeId]);

  const handleStatusChange = async (task: BusinessTask, newStatus: TaskStatus) => {
    if (!user) return;
    try {
      // Acteer met de identiteit die ÉCHT in assignedTo staat (employee doc-ID
      // of auth-UID). Dat is nodig zowel voor de per-persoon voltooiing als voor
      // de toegangscheck in updateTask (taken aangemaakt door een manager hebben
      // userId = manager, dus de employee moet als assignee herkend worden).
      const assigned = task.assignedTo || [];
      const selfId =
        (currentEmployeeId && assigned.includes(currentEmployeeId)) ? currentEmployeeId :
        assigned.includes(user.uid) ? user.uid :
        (currentEmployeeId || user.uid);

      let patch: Record<string, unknown>;
      if (newStatus === 'completed') {
        patch = { ...computeTaskCompletionPatch(task, selfId, true) };
      } else if (task.status === 'completed') {
        patch = { ...computeTaskCompletionPatch(task, selfId, false), status: newStatus };
      } else {
        patch = { status: newStatus };
      }
      await updateTask(task.id, selfId, patch);
      success('Status bijgewerkt');
    } catch (err) {
      console.error('Error updating status:', err);
      error('Fout', 'Fout bij bijwerken van status');
    }
  };

  const toggleTaskSubtask = async (task: BusinessTask, subtaskId: string) => {
    if (!user) return;
    try {
      const assigned = task.assignedTo || [];
      const selfId =
        (currentEmployeeId && assigned.includes(currentEmployeeId)) ? currentEmployeeId :
        assigned.includes(user.uid) ? user.uid :
        (currentEmployeeId || user.uid);

      const updatedChecklist = (task.checklist || []).map(item => {
        if (item.id === subtaskId) {
          return {
            ...item,
            completed: !item.completed,
            completedBy: !item.completed ? user.uid : undefined,
            completedAt: !item.completed ? new Date() : undefined,
          };
        }
        return item;
      });
      const completedCount = updatedChecklist.filter(item => item.completed).length;
      const progress = updatedChecklist.length > 0 ? Math.round((completedCount / updatedChecklist.length) * 100) : 0;
      await updateTask(task.id, selfId, { checklist: updatedChecklist, progress });
    } catch (err) {
      console.error('Error updating subtask:', err);
      error('Fout', 'Fout bij bijwerken van subtaak');
    }
  };

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

  const isOverdue = (task: BusinessTask) => {
    if (task.status === 'completed' || task.status === 'cancelled') return false;
    return new Date(task.dueDate) < new Date();
  };

  // Datumgrenzen voor bucketing
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  // Einde van deze week (zondag 23:59), ISO-week start maandag
  const dayIdx = (now.getDay() + 6) % 7; // 0 = maandag
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(startOfToday.getDate() + (6 - dayIdx));
  endOfWeek.setHours(23, 59, 59, 999);

  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const doneTasks = tasks
    .filter(t => t.status === 'completed' || t.status === 'cancelled')
    .sort((a, b) => {
      const ad = a.completedDate ? new Date(a.completedDate).getTime() : 0;
      const bd = b.completedDate ? new Date(b.completedDate).getTime() : 0;
      return bd - ad;
    });

  const bucketOf = (task: BusinessTask): ActiveBucket => {
    if (task.isRecurring) return 'recurring';
    const due = new Date(task.dueDate);
    if (due < startOfToday) return 'overdue';
    if (due <= endOfToday) return 'today';
    if (due <= endOfWeek) return 'week';
    return 'later';
  };

  const buckets: Record<ActiveBucket, BusinessTask[]> = {
    overdue: [], today: [], week: [], later: [], recurring: [],
  };
  activeTasks.forEach(t => { buckets[bucketOf(t)].push(t); });

  const SECTION_META: Record<ActiveBucket, { label: string; icon: React.ComponentType<{ className?: string }>; accent: string }> = {
    overdue:   { label: 'Te laat',     icon: AlertCircle,   accent: 'text-red-600 dark:text-red-400' },
    today:     { label: 'Vandaag',     icon: Sun,           accent: 'text-amber-600 dark:text-amber-400' },
    week:      { label: 'Deze week',   icon: CalendarRange, accent: 'text-sky-600 dark:text-sky-400' },
    later:     { label: 'Later',       icon: Clock,         accent: 'text-gray-500 dark:text-gray-400' },
    recurring: { label: 'Terugkerend', icon: Repeat,        accent: 'text-purple-600 dark:text-purple-400' },
  };
  const SECTION_ORDER: ActiveBucket[] = ['overdue', 'today', 'week', 'later', 'recurring'];

  const overdueCount = activeTasks.filter(isOverdue).length;

  const renderTaskCard = (task: BusinessTask) => {
    const categoryConfig = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG['operational'];
    const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['medium'];
    const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG['pending'];
    const CategoryIcon = categoryConfig.icon;
    const StatusIcon = statusConfig.icon;
    const isExpanded = expandedTaskId === task.id;

    return (
      <Card key={task.id} className="hover:shadow-md transition-shadow">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <button
                onClick={() => {
                  if (task.status === 'completed') handleStatusChange(task, 'pending');
                  else if (task.status === 'in_progress') handleStatusChange(task, 'completed');
                  else handleStatusChange(task, 'in_progress');
                }}
                className="mt-1 flex-shrink-0"
                title={
                  task.status === 'completed' ? 'Markeer als te doen' :
                  task.status === 'in_progress' ? 'Markeer als voltooid' : 'Start taak'
                }
              >
                {task.status === 'completed' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : task.status === 'in_progress' ? (
                  <PlayCircle className="h-5 w-5 text-blue-600" />
                ) : (
                  <Circle className="h-5 w-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`font-semibold text-gray-900 dark:text-gray-100 ${task.status === 'completed' ? 'line-through text-gray-500 dark:text-gray-300' : ''}`}>
                    {task.title}
                  </h3>
                  {task.isRecurring && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      <Repeat className="h-3 w-3" />
                      {FREQUENCY_LABELS[task.frequency || 'monthly']}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {task.internalProjectName && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                      {task.internalProjectName}
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${categoryConfig.color}`}>
                    <CategoryIcon className="h-3 w-3" />
                    {categoryConfig.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${priorityConfig.color}`}>
                    {priorityConfig.label}
                  </span>
                  {task.estimatedHours && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      <CalendarDays className="h-3 w-3" />
                      ~{task.estimatedHours}u
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${statusConfig.color}`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${isOverdue(task) ? 'bg-red-100 text-red-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                    <Calendar className="h-3 w-3" />
                    {formatDate(task.dueDate)}
                  </span>
                  {task.checklist && task.checklist.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-700">
                      <ListChecks className="h-3 w-3" />
                      {task.checklist.filter(s => s.completed).length}/{task.checklist.length}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-300" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-500 dark:text-gray-300" />
              )}
            </button>
          </div>

          {isExpanded && (task.description || (task.checklist && task.checklist.length > 0)) && (
            <div className="pl-8 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-3">
              {task.description && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase mb-1">Beschrijving</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{task.description}</p>
                </div>
              )}
              {task.checklist && task.checklist.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase mb-2">
                    Subtaken ({task.checklist.filter(s => s.completed).length}/{task.checklist.length})
                  </h4>
                  <div className="space-y-1">
                    {task.checklist.map((subtask) => (
                      <label key={subtask.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={subtask.completed}
                          onChange={() => toggleTaskSubtask(task, subtask.id)}
                          className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                        />
                        <span className={`text-sm ${subtask.completed ? 'line-through text-gray-500 dark:text-gray-300' : 'text-gray-700 dark:text-gray-300'}`}>
                          {subtask.title}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {task.progress !== undefined && task.progress > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-300 mb-1">
                    <span>Voortgang</span>
                    <span>{task.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${task.progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mijn Taken</h1>
          <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
            {activeTasks.length} openstaand{overdueCount > 0 && `, ${overdueCount} te laat`}
          </p>
        </div>
        {userRole === 'employee' && (
          <Link
            to="/employee-dashboard/agenda"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
          >
            <CalendarDays className="h-4 w-4" />
            Agenda
          </Link>
        )}
      </div>

      {/* Tab toggle: Actief / Voltooid */}
      <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden w-fit">
        <button
          onClick={() => setView('active')}
          className={`px-4 py-2 text-sm font-medium flex items-center gap-1.5 ${
            view === 'active'
              ? 'bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-400'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
          }`}
        >
          <ListChecks className="h-4 w-4" />
          Actief ({activeTasks.length})
        </button>
        <button
          onClick={() => setView('done')}
          className={`px-4 py-2 text-sm font-medium flex items-center gap-1.5 border-l border-gray-300 dark:border-gray-600 ${
            view === 'done'
              ? 'bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-400'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Voltooid ({doneTasks.length})
        </button>
      </div>

      {/* Actief: gegroepeerde secties */}
      {view === 'active' && (
        activeTasks.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Geen openstaande taken"
            description="Er zijn geen taken aan jou toegewezen om op te pakken"
          />
        ) : (
          <div className="space-y-6">
            {SECTION_ORDER.map(bucket => {
              const list = buckets[bucket];
              if (list.length === 0) return null;
              const meta = SECTION_META[bucket];
              const SectionIcon = meta.icon;
              return (
                <div key={bucket}>
                  <h2 className={`flex items-center gap-2 text-sm font-semibold mb-2 ${meta.accent}`}>
                    <SectionIcon className="h-4 w-4" />
                    {meta.label}
                    <span className="text-xs font-normal text-gray-400 dark:text-gray-500">({list.length})</span>
                  </h2>
                  <div className="space-y-3">
                    {list.map(renderTaskCard)}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Voltooid */}
      {view === 'done' && (
        doneTasks.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nog niets voltooid"
            description="Afgeronde taken verschijnen hier"
          />
        ) : (
          <div className="space-y-3">
            {doneTasks.map(renderTaskCard)}
          </div>
        )
      )}
    </div>
  );
};

export default EmployeeTasks;
