import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  Filter,
  Calendar,
  Users,
  ListChecks,
  Repeat,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  CalendarDays,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { BusinessTask, TaskCategory, TaskPriority, TaskStatus } from '../types';
import { getTasksAssignedToUser, updateTask } from '../services/firebase';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import { usePageTitle } from '../contexts/PageTitleContext';
import { CATEGORY_CONFIG, PRIORITY_CONFIG, STATUS_CONFIG, FREQUENCY_LABELS } from '../utils/taskConfig';
import { computeTaskCompletionPatch } from '../utils/taskCompletion';

const EmployeeTasks: React.FC = () => {
  const { user, adminUserId } = useAuth();
  const { selectedCompany, currentEmployeeId } = useApp();
  const { success, error } = useToast();
  usePageTitle('Mijn Taken');

  const [tasks, setTasks] = useState<BusinessTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<TaskCategory | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const assignedTasks = await getTasksAssignedToUser(currentEmployeeId || user.uid, selectedCompany?.id);
      setTasks(assignedTasks);
    } catch (err) {
      console.error('Error loading tasks:', err);
      error('Fout', 'Kon taken niet laden');
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompany?.id, error]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleStatusChange = async (task: BusinessTask, newStatus: TaskStatus) => {
    if (!user || !adminUserId) return;

    try {
      // Medewerker markeert per persoon af met de eigen employee doc-ID — exact
      // de id-ruimte waarmee taken aan medewerkers worden toegewezen.
      const selfId = currentEmployeeId || user.uid;
      let patch: Record<string, unknown>;
      if (newStatus === 'completed') {
        patch = { ...computeTaskCompletionPatch(task, selfId, true) };
      } else if (task.status === 'completed') {
        // Terug van voltooid: de-markeer voor deze persoon, daarna gevraagde status
        patch = { ...computeTaskCompletionPatch(task, selfId, false), status: newStatus };
      } else {
        patch = { status: newStatus };
      }
      await updateTask(task.id, adminUserId, patch);
      success('Status bijgewerkt');
      loadTasks();
    } catch (err) {
      console.error('Error updating status:', err);
      error('Fout', 'Fout bij bijwerken van status');
    }
  };

  const toggleTaskSubtask = async (task: BusinessTask, subtaskId: string) => {
    if (!user || !adminUserId) return;

    try {
      const updatedChecklist = (task.checklist || []).map(item => {
        if (item.id === subtaskId) {
          const updated = {
            ...item,
            completed: !item.completed,
            completedBy: !item.completed ? user.uid : undefined,
            completedAt: !item.completed ? new Date() : undefined,
          };
          return updated;
        }
        return item;
      });

      const completedCount = updatedChecklist.filter(item => item.completed).length;
      const progress = updatedChecklist.length > 0 ? Math.round((completedCount / updatedChecklist.length) * 100) : 0;

      await updateTask(task.id, adminUserId, {
        checklist: updatedChecklist,
        progress,
      });
      loadTasks();
    } catch (err) {
      console.error('Error updating subtask:', err);
      error('Fout', 'Fout bij bijwerken van subtaak');
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const isOverdue = (task: BusinessTask) => {
    if (task.status === 'completed' || task.status === 'cancelled') return false;
    return new Date(task.dueDate) < new Date();
  };

  // Filtering
  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterCategory !== 'all' && task.category !== filterCategory) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    return true;
  });

  // Groepering: actieve taken eerst, dan voltooide
  const activeTasks = filteredTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const completedTasks = filteredTasks.filter(t => t.status === 'completed' || t.status === 'cancelled');
  const sortedTasks = [...activeTasks, ...completedTasks];

  const activeCount = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
  const overdueCount = tasks.filter(t => isOverdue(t)).length;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mijn Taken</h1>
          <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
            {activeCount} openstaand{overdueCount > 0 && `, ${overdueCount} te laat`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/employee-dashboard/agenda"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
          >
            <CalendarDays className="h-4 w-4" />
            Agenda
          </Link>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showFilters
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Status samenvatting */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { status: 'pending' as TaskStatus, count: tasks.filter(t => t.status === 'pending').length },
          { status: 'in_progress' as TaskStatus, count: tasks.filter(t => t.status === 'in_progress').length },
          { status: 'overdue' as TaskStatus, count: overdueCount },
          { status: 'completed' as TaskStatus, count: tasks.filter(t => t.status === 'completed').length },
        ].map(({ status, count }) => {
          const config = STATUS_CONFIG[status];
          const Icon = config.icon;
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
              className={`p-3 rounded-xl border-2 transition-all ${
                filterStatus === status
                  ? 'border-primary-500 bg-primary-50 dark:bg-gray-700'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-gray-500 dark:text-gray-300" />
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{count}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1 text-left">{config.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Categorie</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as TaskCategory | 'all')}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">Alle categorieën</option>
                {Object.entries(CATEGORY_CONFIG).map(([category, config]) => (
                  <option key={category} value={category}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Prioriteit</label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as TaskPriority | 'all')}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">Alle prioriteiten</option>
                {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
                  <option key={priority} value={priority}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Tasks List */}
      {sortedTasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Geen taken gevonden"
          description={filterStatus !== 'all' || filterCategory !== 'all' || filterPriority !== 'all'
            ? 'Pas je filters aan om taken te zien'
            : 'Er zijn nog geen taken aan jou toegewezen'
          }
        />
      ) : (
        <div className="space-y-3">
          {sortedTasks.map((task) => {
            const categoryConfig = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG['operational'];
            const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['medium'];
            const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG['pending'];
            const CategoryIcon = categoryConfig.icon;
            const StatusIcon = statusConfig.icon;
            const isExpanded = expandedTaskId === task.id;

            return (
              <Card key={task.id} className="hover:shadow-md transition-shadow">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        onClick={() => {
                          if (task.status === 'completed') {
                            handleStatusChange(task, 'pending');
                          } else if (task.status === 'in_progress') {
                            handleStatusChange(task, 'completed');
                          } else {
                            handleStatusChange(task, 'in_progress');
                          }
                        }}
                        className="mt-1"
                        title={
                          task.status === 'completed' ? 'Markeer als te doen' :
                          task.status === 'in_progress' ? 'Markeer als voltooid' :
                          'Start taak'
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
                          <h3
                            className={`font-semibold text-gray-900 dark:text-gray-100 ${
                              task.status === 'completed' ? 'line-through text-gray-500 dark:text-gray-300' : ''
                            }`}
                          >
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

                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                            isOverdue(task) ? 'bg-red-100 text-red-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                          }`}>
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

                  {/* Expanded content */}
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
                              <label
                                key={subtask.id}
                                className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                              >
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

                      {/* Voortgang balk */}
                      {task.progress !== undefined && task.progress > 0 && (
                        <div>
                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-300 mb-1">
                            <span>Voortgang</span>
                            <span>{task.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-primary-600 h-2 rounded-full transition-all"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmployeeTasks;
