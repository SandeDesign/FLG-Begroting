import React, { useState, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Filter,
  Calendar,
  ListChecks,
  Repeat,
  ChevronDown,
  ChevronRight,
  Circle,
  CheckCircle2,
  Users,
  Clock,
  List,
  CheckCircle,
  CalendarClock,
  AlertCircle,
  MinusCircle,
  Building2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { BusinessTask, TaskCategory, TaskPriority, TaskStatus, TaskFrequency, TaskChecklistItem, Employee } from '../types';
import { InternalProject } from '../types/internalProject';
import {
  subscribeCompanyTasks,
  createTask,
  createTasksForAssignees,
  updateTask,
  deleteTask,
  deleteDuplicateTasks,
  getEmployees,
  getAdminNonEmployeeUsers,
} from '../services/firebase';
import { filterEmployeesForCompany } from '../utils/companyHelpers';
import { isTaskOverdue } from '../utils/taskDeadline';
import { getInternalProjects } from '../services/internalProjectService';
import { getProjectColorMeta } from './InternalProjects';
import { computeTaskCompletionPatch } from '../utils/taskCompletion';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../hooks/useToast';
import Modal from '../components/ui/Modal';
import { usePageTitle } from '../contexts/PageTitleContext';
import { isInQuarter } from '../utils/dateFilters';
import { CATEGORY_CONFIG, PRIORITY_CONFIG, STATUS_CONFIG, FREQUENCY_LABELS, FREQUENCY_CONFIG } from '../utils/taskConfig';

const Tasks: React.FC = () => {
  const { user, userRole, adminUserId } = useAuth();
  const { selectedCompany, selectedYear, selectedQuarter, companies, queryUserId, employees: contextEmployees } = useApp();
  const { success, error } = useToast();
  usePageTitle('Taken');

  const [tasks, setTasks] = useState<BusinessTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [allPeople, setAllPeople] = useState<Array<{ id: string; name: string }>>([]);
  const [internalProjects, setInternalProjects] = useState<InternalProject[]>([]);
  const [editingTask, setEditingTask] = useState<BusinessTask | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<'active' | 'done'>('active');
  const [viewMode, setViewMode] = useState<'list' | 'byEmployee'>('list');

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<TaskCategory | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [filterScheduled, setFilterScheduled] = useState<'all' | 'scheduled' | 'unscheduled'>('all');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'operational' as TaskCategory,
    priority: 'medium' as TaskPriority,
    dueDate: '',
    isRecurring: false,
    frequency: 'monthly' as TaskFrequency,
    recurrenceDay: 1,
    weekdaysOnly: false,
    checklist: [] as TaskChecklistItem[],
    assignedTo: [] as string[],
    estimatedHours: '' as string,
    internalProjectId: '' as string,
    schedulingType: 'fixed' as 'fixed' | 'flexible',
  });
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Realtime taken voor het geselecteerde bedrijf (live updates bij toewijzen/wijzigen).
  useEffect(() => {
    if (!user || !selectedCompany) return;
    setLoading(true);
    const unsub = subscribeCompanyTasks(
      selectedCompany.id,
      (companyTasks) => {
        setTasks(companyTasks);
        setLoading(false);
      },
      (err) => {
        console.error('Error subscribing tasks:', err);
        error('Fout bij laden van taken');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user, selectedCompany?.id]);

  useEffect(() => {
    if (user && selectedCompany) {
      const loadPeople = async () => {
        const effectiveUserId = queryUserId || adminUserId;
        // Gebruik medewerkers die AppContext al heeft geladen, gefilterd op het
        // geselecteerde bedrijf via de gedeelde employer-/project-logica (zodat
        // medewerkers die via een werkmaatschappij aan een project gekoppeld zijn
        // óók verschijnen). Fallback: directe query.
        const baseEmps = contextEmployees.length > 0
          ? contextEmployees
          : await getEmployees(effectiveUserId, selectedCompany.id);
        const emps = filterEmployeesForCompany(baseEmps, selectedCompany);
        const empPeople = emps.map(e => ({
          id: e.id!,
          name: [e.personalInfo?.firstName, e.personalInfo?.lastName].filter(Boolean).join(' ') || e.id!,
        }));
        const empDocIds = emps.map(e => e.id!);

        // Admin, co-admins en managers — geen duplicaten met medewerkers
        const nonEmpUsers = await getAdminNonEmployeeUsers(effectiveUserId, empDocIds);

        // Admin zichzelf: gebruik auth context voor naam (altijd accuraat, ook zonder Firestore naam)
        const adminName = user.displayName || user.email || 'Admin';
        const existingIds = new Set([...empPeople.map(p => p.id), ...nonEmpUsers.map(u => u.uid)]);
        if (!existingIds.has(user.uid)) {
          nonEmpUsers.push({ uid: user.uid, name: adminName });
        } else {
          const idx = nonEmpUsers.findIndex(u => u.uid === user.uid);
          if (idx !== -1 && !nonEmpUsers[idx].name) {
            nonEmpUsers[idx] = { uid: user.uid, name: adminName };
          }
        }

        // Normaliseer naar { id, name } zodat person.id altijd bestaat (key prop + task matching)
        const nonEmpPeople = nonEmpUsers.map(u => ({ id: u.uid, name: u.name }));
        setAllPeople([...empPeople, ...nonEmpPeople]);
      };
      loadPeople().catch(() => {});
      getInternalProjects((queryUserId || adminUserId)!, selectedCompany.id).then(setInternalProjects).catch(() => {});
    }
  }, [user, selectedCompany, queryUserId, contextEmployees]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompany) return;

    if (!formData.title.trim()) {
      error('Titel is verplicht');
      return;
    }
    if (!formData.dueDate || isNaN(new Date(formData.dueDate).getTime())) {
      error('Geldige deadline is verplicht');
      return;
    }

    try {
      const progress = calculateProgress(formData.checklist);
      // Bij meerdere toegewezenen → individuele taken per persoon.
      const createdIds = await createTasksForAssignees(user.uid, {
        ...formData,
        companyId: selectedCompany.id,
        dueDate: new Date(formData.dueDate),
        progress,
        assignedTo: formData.assignedTo,
        estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : undefined,
        internalProjectId: formData.internalProjectId || undefined,
        internalProjectName: internalProjects.find(p => p.id === formData.internalProjectId)?.name || undefined,
      });

      success(createdIds.length > 1 ? `${createdIds.length} taken aangemaakt (1 per persoon)` : 'Taak aangemaakt');
      setShowTaskModal(false);
      resetForm();
    } catch (err) {
      console.error('Error creating task:', err);
      error('Fout bij aanmaken van taak');
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingTask) return;

    if (!formData.title.trim()) {
      error('Titel is verplicht');
      return;
    }
    if (!formData.dueDate || isNaN(new Date(formData.dueDate).getTime())) {
      error('Geldige deadline is verplicht');
      return;
    }

    try {
      const progress = calculateProgress(formData.checklist);
      // Bewerken = simpele update (géén splitsing/extra taken aanmaken; dat
      // gebeurt alleen bij het AANMAKEN via createTasksForAssignees). Anders
      // ontstonden er duplicaten bij elke keer opslaan.
      await updateTask(editingTask.id, user.uid, {
        ...formData,
        dueDate: new Date(formData.dueDate),
        progress,
        assignedTo: formData.assignedTo,
        estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : undefined,
        internalProjectId: formData.internalProjectId || undefined,
        internalProjectName: internalProjects.find(p => p.id === formData.internalProjectId)?.name || undefined,
      });

      success('Taak bijgewerkt');
      setShowTaskModal(false);
      setEditingTask(null);
      resetForm();
    } catch (err) {
      console.error('Error updating task:', err);
      error('Fout bij bijwerken van taak');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    if (!confirm('Weet je zeker dat je deze taak wilt verwijderen?')) return;

    try {
      await deleteTask(taskId, user.uid);
      success('Taak verwijderd');
    } catch (err) {
      console.error('Error deleting task:', err);
      error('Fout bij verwijderen van taak');
    }
  };

  const handleCleanupDuplicates = async () => {
    if (!selectedCompany) return;
    if (!confirm('Dubbele taken opruimen? Identieke taken (zelfde titel, dag, toegewezene en status) worden teruggebracht tot één. De oudste blijft behouden.')) return;
    try {
      const removed = await deleteDuplicateTasks(selectedCompany.id);
      success(removed > 0 ? `${removed} dubbele taken verwijderd` : 'Geen duplicaten gevonden');
    } catch (err) {
      console.error('Error cleaning duplicates:', err);
      error('Fout bij opruimen van duplicaten');
    }
  };

  const handleStatusChange = async (task: BusinessTask, newStatus: TaskStatus) => {
    if (!user) return;

    try {
      // Admin/manager handelt als deelnemer met de eigen auth-UID — exact de
      // id-ruimte waarmee admins in assignedTo worden gezet.
      const patch = computeTaskCompletionPatch(task, user.uid, newStatus === 'completed');
      await updateTask(task.id, user.uid, patch);

      success('Status bijgewerkt');
    } catch (err) {
      console.error('Error updating status:', err);
      error('Fout bij bijwerken van status');
    }
  };

  const openEditModal = (task: BusinessTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      category: task.category,
      priority: task.priority,
      dueDate: task.dueDate instanceof Date ? task.dueDate.toISOString().split('T')[0] : '',
      isRecurring: task.isRecurring,
      frequency: task.frequency || 'monthly',
      recurrenceDay: task.recurrenceDay || 1,
      weekdaysOnly: task.weekdaysOnly || false,
      checklist: task.checklist || [],
      assignedTo: task.assignedTo || [],
      estimatedHours: task.estimatedHours !== undefined ? String(task.estimatedHours) : '',
      internalProjectId: task.internalProjectId || '',
      schedulingType: task.schedulingType === 'flexible' ? 'flexible' : 'fixed',
    });
    setShowTaskModal(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'operational',
      priority: 'medium',
      dueDate: '',
      isRecurring: false,
      frequency: 'monthly',
      recurrenceDay: 1,
      weekdaysOnly: false,
      checklist: [],
      assignedTo: [],
      estimatedHours: '',
      internalProjectId: '',
      schedulingType: 'fixed',
    });
    setNewSubtaskTitle('');
    setEditingTask(null);
  };

  // Filter taken
  const filteredTasks = tasks.filter(task => {
    // Period filter on dueDate
    if (task.dueDate) {
      const taskDate = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
      if (!isInQuarter(taskDate, selectedYear, selectedQuarter)) return false;
    }

    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterCategory !== 'all' && task.category !== filterCategory) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;

    // Filter op inplanstatus
    if (filterScheduled === 'scheduled' && !task.isScheduled) return false;
    if (filterScheduled === 'unscheduled' && task.isScheduled) return false;

    return true;
  });

  // Actieve vs. afgeronde taken — voltooid/geannuleerd hoort in een aparte tab
  // (houdt de actieve overzichten schoon).
  const activeTasks = filteredTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const doneTasks = filteredTasks
    .filter(t => t.status === 'completed' || t.status === 'cancelled')
    .sort((a, b) => {
      const ad = a.completedDate ? new Date(a.completedDate).getTime() : 0;
      const bd = b.completedDate ? new Date(b.completedDate).getTime() : 0;
      return bd - ad;
    });

  // Calculate progress based on subtasks
  const calculateProgress = (checklist: TaskChecklistItem[]): number => {
    if (!checklist || checklist.length === 0) return 0;
    const completed = checklist.filter(item => item.completed).length;
    return Math.round((completed / checklist.length) * 100);
  };

  // Subtask management
  const addSubtask = () => {
    if (!newSubtaskTitle.trim()) return;

    const newSubtask: TaskChecklistItem = {
      id: `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };

    setFormData({ ...formData, checklist: [...formData.checklist, newSubtask] });
    setNewSubtaskTitle('');
  };

  const removeSubtask = (subtaskId: string) => {
    setFormData({
      ...formData,
      checklist: formData.checklist.filter(item => item.id !== subtaskId)
    });
  };

  const toggleSubtask = (subtaskId: string) => {
    setFormData({
      ...formData,
      checklist: formData.checklist.map(item =>
        item.id === subtaskId
          ? { ...item, completed: !item.completed }
          : item
      )
    });
  };

  // Toggle subtask in task list (update database directly)
  const toggleTaskSubtask = async (task: BusinessTask, subtaskId: string) => {
    if (!user) return;

    try {
      const updatedChecklist = (task.checklist || []).map(item => {
        if (item.id === subtaskId) {
          const newItem: any = {
            ...item,
            completed: !item.completed
          };

          // Voeg completedBy en completedAt alleen toe wanneer completed=true
          if (!item.completed) {
            newItem.completedBy = user.uid;
            newItem.completedAt = new Date();
          } else {
            // Verwijder deze velden als completed=false wordt
            delete newItem.completedBy;
            delete newItem.completedAt;
          }

          return newItem;
        }
        return item;
      });

      const progress = calculateProgress(updatedChecklist);
      await updateTask(task.id, user.uid, {
        checklist: updatedChecklist,
        progress
      });
    } catch (err) {
      console.error('Error updating subtask:', err);
      error('Fout bij bijwerken van subtaak');
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const isOverdue = (task: BusinessTask) => isTaskOverdue(task);

  // Herbruikbare taakkaart (lijst, kanban-kolom en Voltooid-tab).
  const renderTaskListCard = (task: BusinessTask) => {
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
              {(() => {
                const isMultiAssignee = task.assignedTo && task.assignedTo.length > 1;
                const myDone = isMultiAssignee
                  ? (task.completedByUsers || []).includes(user?.uid || '')
                  : task.status === 'completed';
                const newStatus = myDone ? 'pending' : 'completed';
                return (
                  <button
                    onClick={() => handleStatusChange(task, newStatus)}
                    className="mt-1 flex-shrink-0"
                    title={isMultiAssignee ? (myDone ? 'Markeer als niet voltooid (voor jou)' : 'Markeer als voltooid (voor jou)') : undefined}
                  >
                    {myDone ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400" />
                    )}
                  </button>
                );
              })()}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    className={`font-semibold text-gray-900 dark:text-gray-100 ${ task.status === 'completed' ? 'line-through text-gray-500 dark:text-gray-300 dark:text-gray-500' : '' }`}
                  >
                    {task.title}
                  </h3>
                  {task.isRecurring && task.frequency && FREQUENCY_CONFIG[task.frequency] && (() => {
                    const FreqIcon = FREQUENCY_CONFIG[task.frequency!].icon;
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${FREQUENCY_CONFIG[task.frequency!].bgColor}`}>
                        <FreqIcon className="h-3 w-3" />
                        {FREQUENCY_CONFIG[task.frequency!].label}
                      </span>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${categoryConfig.color}`}>
                    <CategoryIcon className="h-3 w-3" />
                    {categoryConfig.label}
                  </span>

                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${priorityConfig.color}`}>
                    {priorityConfig.label}
                  </span>

                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${statusConfig.color}`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </span>

                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${ isOverdue(task) ? 'bg-red-100 text-red-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' }`}>
                    <Calendar className="h-3 w-3" />
                    {formatDate(task.dueDate)}
                  </span>

                  {/* Bedrijfsnaam badge voor admin/co-admin */}
                  {(userRole === 'admin' || (adminUserId && adminUserId !== user?.uid)) && (() => {
                    const company = companies.find(c => c.id === task.companyId);
                    if (!company || company.id === selectedCompany?.id) return null;
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                        <Building2 className="h-3 w-3" />
                        {company.name}
                      </span>
                    );
                  })()}

                  {task.checklist && task.checklist.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-700">
                      <ListChecks className="h-3 w-3" />
                      {task.checklist.filter(s => s.completed).length}/{task.checklist.length}
                    </span>
                  )}

                  {/* Toegewezen personen */}
                  {task.assignedTo && task.assignedTo.length > 0 && (() => {
                    const assignees = task.assignedTo!
                      .map(id => allPeople.find(p => p.id === id))
                      .filter(Boolean) as Array<{ id: string; name: string }>;
                    if (assignees.length === 0) return null;
                    return assignees.map(p => (
                      <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                        <Users className="h-3 w-3" />
                        {p.name.split(' ')[0]}
                      </span>
                    ));
                  })()}

                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-300" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500 dark:text-gray-300" />
                )}
              </button>
              {userRole !== 'boekhouder' && (
                <>
                  <button
                    onClick={() => openEditModal(task)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-300" />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </>
              )}
            </div>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Taken</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            {selectedCompany?.name} - {tasks.length} taken
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Hoofd-tab: Actief / Voltooid */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => setMainTab('active')}
              className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 ${
                mainTab === 'active'
                  ? 'bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-400'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <ListChecks className="h-4 w-4" />
              Actief ({activeTasks.length})
            </button>
            <button
              onClick={() => setMainTab('done')}
              className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 border-l border-gray-300 dark:border-gray-600 ${
                mainTab === 'done'
                  ? 'bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-400'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <CheckCircle className="h-4 w-4" />
              Voltooid ({doneTasks.length})
            </button>
          </div>

          {/* Weergave-toggle (alleen binnen Actief) */}
          {mainTab === 'active' && (
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 ${
                  viewMode === 'list'
                    ? 'bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-400'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                <List className="h-4 w-4" />
                Lijst
              </button>
              <button
                onClick={() => setViewMode('byEmployee')}
                className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 border-l border-gray-300 dark:border-gray-600 ${
                  viewMode === 'byEmployee'
                    ? 'bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-400'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Users className="h-4 w-4" />
                Per medewerker
              </button>
            </div>
          )}
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="secondary"
            icon={Filter}
          >
            Filters
          </Button>
          {userRole !== 'boekhouder' && (
            <Button
              onClick={handleCleanupDuplicates}
              variant="secondary"
              icon={Trash2}
            >
              Dubbele opruimen
            </Button>
          )}
          {userRole !== 'boekhouder' && (
            <Button
              onClick={() => {
                resetForm();
                setShowTaskModal(true);
              }}
              icon={Plus}
            >
              Nieuwe taak
            </Button>
          )}
        </div>
      </div>

      {/* Collapsible Filters */}
      {showFilters && (
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as TaskStatus | 'all')}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">Alle statussen</option>
                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                  <option key={status} value={status}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Categorie
              </label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as TaskCategory | 'all')}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">Alle categorieën</option>
                {Object.entries(CATEGORY_CONFIG).map(([category, config]) => (
                  <option key={category} value={category}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Prioriteit
              </label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as TaskPriority | 'all')}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">Alle prioriteiten</option>
                {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
                  <option key={priority} value={priority}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Inplanning
              </label>
              <select
                value={filterScheduled}
                onChange={(e) => setFilterScheduled(e.target.value as 'all' | 'scheduled' | 'unscheduled')}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="all">Alle</option>
                <option value="scheduled">Ingepland</option>
                <option value="unscheduled">Niet ingepland</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Per-medewerker overzicht (alleen actieve taken) */}
      {mainTab === 'active' && viewMode === 'byEmployee' && (
        <div className="space-y-4">
          {allPeople.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Geen gebruikers gevonden"
              description="Voeg gebruikers toe om taken toe te wijzen"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allPeople.map(person => {
                const empName = person.name;
                const empTasks = activeTasks.filter(t => t.assignedTo?.includes(person.id));
                // Voltooiing per persoon: gebruik completedByUsers als beschikbaar
                const isCompletedForPerson = (t: BusinessTask) =>
                  t.assignedTo && t.assignedTo.length > 1
                    ? (t.completedByUsers || []).includes(person.id)
                    : t.status === 'completed';
                const scheduled = empTasks.filter(t => !isCompletedForPerson(t) && t.status !== 'cancelled' && t.isScheduled);
                const unscheduled = empTasks.filter(t => !isCompletedForPerson(t) && t.status !== 'cancelled' && t.status !== 'overdue' && !t.isScheduled);
                const overdue = empTasks.filter(t => !isCompletedForPerson(t) && t.status !== 'cancelled' && (t.status === 'overdue' || (!t.isScheduled && isTaskOverdue(t))));

                const statGroups = [
                  { label: 'Ingepland', count: scheduled.length, tasks: scheduled, icon: CalendarClock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-gray-700', border: 'border-blue-200 dark:border-blue-800' },
                  { label: 'Niet ingepland', count: unscheduled.length, tasks: unscheduled, icon: MinusCircle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-gray-700', border: 'border-amber-200 dark:border-amber-800' },
                  { label: 'Te laat', count: overdue.length, tasks: overdue, icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-gray-700', border: 'border-red-200 dark:border-red-800' },
                ];

                return (
                  <Card key={person.id} className="!p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-semibold text-primary-700 dark:text-primary-300">
                          {empName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{empName}</span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-300">{empTasks.length} taken</span>
                    </div>

                    {empTasks.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">Geen taken toegewezen</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {statGroups.map(group => {
                          const Icon = group.icon;
                          return (
                            <div key={group.label} className={`rounded-lg border p-2.5 ${group.bg} ${group.border}`}>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Icon className={`h-3.5 w-3.5 ${group.color}`} />
                                <span className={`text-xs font-semibold ${group.color}`}>{group.label}</span>
                                <span className={`ml-auto text-sm font-bold ${group.color}`}>{group.count}</span>
                              </div>
                              {group.tasks.length > 0 && (
                                <ul className="space-y-0.5">
                                  {group.tasks.slice(0, 3).map(t => (
                                    <li key={t.id}>
                                      <button
                                        onClick={() => openEditModal(t)}
                                        className="w-full text-left text-[10px] text-gray-600 dark:text-gray-300 truncate leading-tight hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                                        title={t.title}
                                      >
                                        • {t.title}
                                      </button>
                                    </li>
                                  ))}
                                  {group.tasks.length > 3 && (
                                    <li className="text-[10px] text-gray-400 dark:text-gray-300">+{group.tasks.length - 3} meer</li>
                                  )}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Niet-toegewezen taken */}
          {(() => {
            const unassigned = activeTasks.filter(t => !t.assignedTo || t.assignedTo.length === 0);
            if (unassigned.length === 0) return null;
            return (
              <div className="mt-2">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  Niet toegewezen ({unassigned.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {unassigned.map(t => (
                    <div key={t.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
                      <Circle className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{t.title}</span>
                      {userRole !== 'boekhouder' && (
                        <button onClick={() => openEditModal(t)} className="ml-auto p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded flex-shrink-0">
                          <Pencil className="h-3 w-3 text-gray-400" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Actief — Lijst */}
      {mainTab === 'active' && viewMode === 'list' && (
        activeTasks.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Geen openstaande taken"
            description="Maak een nieuwe taak aan om te beginnen"
            actionLabel={userRole !== 'boekhouder' ? 'Nieuwe taak' : undefined}
            onAction={userRole !== 'boekhouder' ? () => { resetForm(); setShowTaskModal(true); } : undefined}
          />
        ) : (
          <div className="space-y-3">
            {activeTasks.map(renderTaskListCard)}
          </div>
        )
      )}

      {/* Voltooid (aparte tab — houdt actieve overzichten schoon) */}
      {mainTab === 'done' && (
        doneTasks.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title="Nog niets voltooid"
            description="Afgeronde taken verschijnen hier"
          />
        ) : (
          <div className="space-y-3">
            {doneTasks.map(renderTaskListCard)}
          </div>
        )
      )}

      {/* Task Modal */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setEditingTask(null);
          resetForm();
        }}
        title={editingTask ? 'Taak bewerken' : 'Nieuwe taak'}
      >
        <form onSubmit={editingTask ? handleUpdateTask : handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Titel *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Bijv. Facturen versturen"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Beschrijving
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Optionele beschrijving..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Categorie *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as TaskCategory })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                {Object.entries(CATEGORY_CONFIG).map(([category, config]) => (
                  <option key={category} value={category}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Prioriteit *
              </label>
              <select
                required
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
                  <option key={priority} value={priority}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Plandatum *
            </label>
            <input
              type="date"
              required
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
              {formData.schedulingType === 'flexible'
                ? 'Bij flexibel plannen geldt deze datum als deadline van de week.'
                : 'De taak staat vast op deze dag in de agenda van de medewerker.'}
            </p>
          </div>

          {/* Planning: vaste datum vs medewerker plant zelf in */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Planning
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'fixed' as const, label: 'Vaste datum', icon: Calendar },
                { value: 'flexible' as const, label: 'Medewerker plant zelf in', icon: CalendarClock },
              ].map(option => {
                const isSelected = formData.schedulingType === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, schedulingType: option.value })}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-400 ring-1 ring-primary-500'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-300 mt-1.5">
              {formData.schedulingType === 'flexible'
                ? 'De medewerker plaatst deze taak zelf op een dag in zijn agenda.'
                : 'Jij bepaalt de dag; de taak verschijnt vast op de plandatum.'}
            </p>
          </div>

          {/* Toewijzen aan */}
          {allPeople.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Toewijzen aan
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 p-2">
                {allPeople.map(person => {
                  const checked = formData.assignedTo.includes(person.id);
                  return (
                    <label key={person.id} className="flex items-center gap-2 cursor-pointer py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? formData.assignedTo.filter(id => id !== person.id)
                            : [...formData.assignedTo, person.id];
                          setFormData({ ...formData, assignedTo: next });
                        }}
                        className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-900 dark:text-gray-100">{person.name}</span>
                    </label>
                  );
                })}
              </div>
              {formData.assignedTo.length > 1 && (
                <p className="text-xs text-primary-600 dark:text-primary-400 mt-1.5 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Elke persoon krijgt een eigen taak — afvinken geldt alleen voor die persoon.
                </p>
              )}
              {formData.assignedTo.length > 0 && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Verwachte duur (uren)
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={formData.estimatedHours}
                    onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                    placeholder="bijv. 2.5"
                    className="w-32 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">Hoelang de medewerker er mee bezig mag zijn</p>
                </div>
              )}
            </div>
          )}

          {/* Intern project koppeling */}
          {internalProjects.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Intern project (optioneel)
              </label>
              <select
                value={formData.internalProjectId}
                onChange={e => setFormData({ ...formData, internalProjectId: e.target.value })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">— Geen project —</option>
                {internalProjects.map(p => {
                  const cm = getProjectColorMeta(p.color);
                  return (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  );
                })}
              </select>
              {formData.internalProjectId && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  {(() => {
                    const proj = internalProjects.find(p => p.id === formData.internalProjectId);
                    const cm = getProjectColorMeta(proj?.color);
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cm.bg} ${cm.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cm.dot}`} />
                        {proj?.name}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Subtaken sectie */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Subtaken
            </label>

            {/* Lijst van bestaande subtaken */}
            {formData.checklist.length > 0 && (
              <div className="space-y-2 mb-3">
                {formData.checklist.map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <input
                      type="checkbox"
                      checked={subtask.completed}
                      onChange={() => toggleSubtask(subtask.id)}
                      className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className={`flex-1 text-sm ${subtask.completed ? 'line-through text-gray-500 dark:text-gray-300' : 'text-gray-900 dark:text-gray-100'}`}>
                      {subtask.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSubtask(subtask.id)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Nieuwe subtaak toevoegen */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                placeholder="Nieuwe subtaak..."
                className="flex-1 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <Button
                type="button"
                onClick={addSubtask}
                variant="secondary"
                icon={Plus}
              >
                Toevoegen
              </Button>
            </div>
          </div>

          {/* Frequentie sectie - prominent */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
              Frequentie
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: null, label: 'Eenmalig', icon: Calendar },
                ...Object.entries(FREQUENCY_CONFIG).map(([freq, config]) => ({
                  value: freq as TaskFrequency,
                  label: config.label,
                  icon: config.icon,
                })),
              ].map((option) => {
                const isSelected = option.value === null
                  ? !formData.isRecurring
                  : formData.isRecurring && formData.frequency === option.value;
                const Icon = option.icon;

                return (
                  <button
                    key={option.value || 'once'}
                    type="button"
                    onClick={() => {
                      if (option.value === null) {
                        setFormData({ ...formData, isRecurring: false });
                      } else {
                        setFormData({ ...formData, isRecurring: true, frequency: option.value });
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-gray-700 text-primary-700 dark:text-primary-400 ring-1 ring-primary-500'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            {formData.isRecurring && formData.frequency === 'weekly' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Dag van de week
                </label>
                <select
                  value={formData.recurrenceDay || 1}
                  onChange={(e) => setFormData({ ...formData, recurrenceDay: parseInt(e.target.value) })}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100 text-sm px-3 py-1.5"
                >
                  <option value={1}>Maandag</option>
                  <option value={2}>Dinsdag</option>
                  <option value={3}>Woensdag</option>
                  <option value={4}>Donderdag</option>
                  <option value={5}>Vrijdag</option>
                  <option value={6}>Zaterdag</option>
                  <option value={7}>Zondag</option>
                </select>
              </div>
            )}

            {formData.isRecurring && (formData.frequency === 'monthly' || formData.frequency === 'quarterly') && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Dag van de maand (1-31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.recurrenceDay}
                  onChange={(e) => setFormData({ ...formData, recurrenceDay: parseInt(e.target.value) })}
                  className="w-32 rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-white dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            )}

            {formData.isRecurring && (
              <label className="mt-3 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.weekdaysOnly}
                  onChange={(e) => setFormData({ ...formData, weekdaysOnly: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  Alleen op werkdagen (weekend → eerstvolgende maandag)
                </span>
              </label>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowTaskModal(false);
                setEditingTask(null);
                resetForm();
              }}
            >
              Annuleren
            </Button>
            <Button type="submit">
              {editingTask ? 'Opslaan' : 'Aanmaken'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Tasks;
