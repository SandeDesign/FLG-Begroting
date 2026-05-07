import React, { useState, useEffect, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { EventInput, EventClickArg, DateSelectArg } from '@fullcalendar/core';
import {
  CalendarDays,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useToast } from '../hooks/useToast';
import { BusinessTask } from '../types';
import {
  getTasksAssignedToUser,
  scheduleTask,
  unscheduleTask,
  updateTask,
  generateRecurringTasks,
} from '../services/firebase';
import {
  checkAndShowSchedulingReminders,
  getNextFridayDeadline,
} from '../services/taskSchedulingService';
import { PRIORITY_CONFIG } from '../utils/taskConfig';
import TaskScheduleSidebar from '../components/tasks/TaskScheduleSidebar';
import ScheduledTaskPopover from '../components/tasks/ScheduledTaskPopover';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

const EmployeeAgenda: React.FC = () => {
  const { user, adminUserId } = useAuth();
  const { selectedCompany, currentEmployeeId } = useApp();
  const { success, error } = useToast();
  usePageTitle('Mijn Agenda');

  const calendarRef = useRef<FullCalendar>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // State
  const [loading, setLoading] = useState(false);
  const [allTasks, setAllTasks] = useState<BusinessTask[]>([]);
  const [currentView, setCurrentView] = useState<'timeGridDay' | 'timeGridWeek'>('timeGridWeek');
  const [selectedTask, setSelectedTask] = useState<BusinessTask | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [schedulingReminder, setSchedulingReminder] = useState<{ level: string; count: number } | null>(null);
  const [schedulingTask, setSchedulingTask] = useState<BusinessTask | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('09:00');
  const [scheduleEndTime, setScheduleEndTime] = useState('10:00');

  // The userId to use for task access checks (Firestore employee doc ID, not Auth UID)
  const taskUserId = currentEmployeeId || user?.uid || '';

  const unscheduledTasks = allTasks.filter(
    t => !t.isScheduled && t.status !== 'completed' && t.status !== 'cancelled'
  );
  const scheduledTasks = allTasks.filter(t => t.isScheduled);
  const fridayDeadline = getNextFridayDeadline();

  // Initialize FullCalendar Draggable on sidebar container
  useEffect(() => {
    if (sidebarRef.current) {
      const draggable = new Draggable(sidebarRef.current, {
        itemSelector: '[data-task-id]',
        eventData: (eventEl) => {
          const taskId = eventEl.getAttribute('data-task-id');
          const taskTitle = eventEl.getAttribute('data-task-title') || 'Taak';
          const taskColor = eventEl.getAttribute('data-task-color') || '#3b82f6';
          return {
            title: taskTitle,
            duration: '01:00',
            backgroundColor: taskColor,
            borderColor: taskColor,
            textColor: '#ffffff',
            extendedProps: { taskId, type: 'task' },
          };
        },
      });
      return () => draggable.destroy();
    }
  }, []);

  // Load data
  useEffect(() => {
    if (user && selectedCompany) {
      loadTasks();
      checkReminders();
    }
  }, [user, selectedCompany]);

  const loadTasks = async () => {
    if (!user || !selectedCompany || !adminUserId) {
      return;
    }
    try {
      setLoading(true);

      // Genereer nieuwe instanties voor herhalende taken
      const generated = await generateRecurringTasks(adminUserId);
      if (generated > 0) {
        success(`${generated} nieuwe herhalende taak${generated === 1 ? '' : 'en'} aangemaakt`);
      }

      // Haal taken op die aan deze medewerker zijn toegewezen
      const assignedTasks = await getTasksAssignedToUser(taskUserId, selectedCompany.id);
      setAllTasks(assignedTasks as BusinessTask[]);
    } catch (err) {
      console.error('[Agenda] Error laden taken:', err);
      error('Fout bij laden van taken');
    } finally {
      setLoading(false);
    }
  };

  const checkReminders = async () => {
    if (!user || !adminUserId || !selectedCompany) return;
    try {
      const result = await checkAndShowSchedulingReminders(adminUserId, user.uid, selectedCompany.id);
      if (result) {
        setSchedulingReminder({ level: result.level, count: result.unscheduledCount });
      }
    } catch {
      // Silence
    }
  };

  // Convert tasks to FullCalendar events
  const getCalendarEvents = useCallback((): EventInput[] => {
    return scheduledTasks.map(task => {
      const priorityColor = task.priority === 'urgent' ? '#ef4444'
        : task.priority === 'high' ? '#f97316'
        : task.priority === 'medium' ? '#3b82f6'
        : '#6b7280';

      const scheduledDate = task.scheduledDate ? new Date(task.scheduledDate) : new Date(task.dueDate);
      const dateStr = scheduledDate.toISOString().split('T')[0];

      return {
        id: `task-${task.id}`,
        title: task.title,
        start: task.scheduledStartTime ? `${dateStr}T${task.scheduledStartTime}:00` : dateStr,
        end: task.scheduledEndTime ? `${dateStr}T${task.scheduledEndTime}:00` : undefined,
        backgroundColor: priorityColor,
        borderColor: priorityColor,
        textColor: '#ffffff',
        extendedProps: {
          type: 'task',
          taskId: task.id,
          task,
        },
      };
    });
  }, [scheduledTasks]);

  // Handle event click (show popover)
  const handleEventClick = (info: EventClickArg) => {
    if (info.event.extendedProps.type !== 'task') return;
    const rect = info.el.getBoundingClientRect();
    setPopoverPosition({
      top: rect.top + window.scrollY,
      left: Math.min(rect.right + 8, window.innerWidth - 340),
    });
    setSelectedTask(info.event.extendedProps.task);
  };

  // Handle drop from external sidebar — remove element to prevent duplicates
  const handleDrop = (info: { date: Date; draggedEl: HTMLElement }) => {
    info.draggedEl.remove();
  };

  // Handle event receive (when external task is dropped on calendar)
  const handleEventReceive = async (info: any) => {
    const taskId = info.event.extendedProps?.taskId || info.draggedEl?.dataset?.taskid;
    if (!taskId || !user) return;

    const start = info.event.start;
    if (!start) return;

    const startTime = start.toTimeString().substring(0, 5);
    const endDate = info.event.end || new Date(start.getTime() + 60 * 60 * 1000);
    const endTime = endDate.toTimeString().substring(0, 5);

    try {
      await scheduleTask(taskId, taskUserId, start, startTime, endTime);
      success('Taak ingepland');
      loadTasks();
    } catch (err) {
      console.error('Error scheduling task:', err);
      error('Fout bij inplannen van taak');
      info.revert();
    }
  };

  // Handle event drop (drag within calendar to reschedule)
  const handleEventDrop = async (info: any) => {
    const taskId = info.event.extendedProps?.task?.id;
    if (!taskId || !user) {
      info.revert();
      return;
    }

    const start = info.event.start;
    if (!start) return;

    const startTime = start.toTimeString().substring(0, 5);
    const endDate = info.event.end || new Date(start.getTime() + 60 * 60 * 1000);
    const endTime = endDate.toTimeString().substring(0, 5);

    try {
      await scheduleTask(taskId, taskUserId, start, startTime, endTime);
      success('Taak verplaatst');
      loadTasks();
    } catch (err) {
      error('Fout bij verplaatsen');
      info.revert();
    }
  };

  // Handle event resize
  const handleEventResize = async (info: any) => {
    const taskId = info.event.extendedProps?.task?.id;
    if (!taskId || !user) {
      info.revert();
      return;
    }

    const start = info.event.start;
    const end = info.event.end;
    if (!start || !end) return;

    const startTime = start.toTimeString().substring(0, 5);
    const endTime = end.toTimeString().substring(0, 5);

    try {
      await scheduleTask(taskId, taskUserId, start, startTime, endTime);
      loadTasks();
    } catch (err) {
      info.revert();
    }
  };

  // Handle select (click on empty slot — open mobile sidebar)
  const handleDateSelect = (_selectInfo: DateSelectArg) => {
    if (unscheduledTasks.length > 0) {
      setShowMobileSidebar(true);
    }
  };

  const handleUnschedule = async (taskId: string) => {
    if (!user) return;
    try {
      await unscheduleTask(taskId, taskUserId);
      setSelectedTask(null);
      success('Inplanning verwijderd');
      loadTasks();
    } catch (err) {
      error('Fout bij verwijderen inplanning');
    }
  };

  const handleStatusChange = async (taskId: string, status: 'in_progress' | 'completed') => {
    if (!user || !adminUserId) return;
    try {
      await updateTask(taskId, adminUserId, { status });
      setSelectedTask(null);
      success('Status bijgewerkt');
      loadTasks();
    } catch (err) {
      error('Fout bij bijwerken status');
    }
  };

  const handleSidebarTaskClick = (task: BusinessTask) => {
    setShowMobileSidebar(false);
    const today = new Date().toISOString().split('T')[0];
    const endHour = task.estimatedHours ? Math.floor(9 + task.estimatedHours) : 10;
    const endMinute = task.estimatedHours ? Math.round((task.estimatedHours % 1) * 60) : 0;
    setScheduleDate(today);
    setScheduleStartTime('09:00');
    setScheduleEndTime(`${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`);
    setSchedulingTask(task);
  };

  const handleScheduleSubmit = async () => {
    if (!schedulingTask || !user || !scheduleDate) return;
    try {
      const dateObj = new Date(`${scheduleDate}T${scheduleStartTime}:00`);
      await scheduleTask(schedulingTask.id!, taskUserId, dateObj, scheduleStartTime, scheduleEndTime);
      setSchedulingTask(null);
      success('Taak ingepland');
      loadTasks();
    } catch (err) {
      console.error('Error scheduling task:', err);
      error('Fout bij inplannen van taak');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mijn Agenda</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            {unscheduledTasks.length > 0
              ? `${unscheduledTasks.length} ${unscheduledTasks.length === 1 ? 'taak' : 'taken'} nog in te plannen`
              : 'Alle taken zijn ingepland'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle — icons only */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => {
                setCurrentView('timeGridWeek');
                calendarRef.current?.getApi().changeView('timeGridWeek');
              }}
              title="Weekweergave"
              className={`px-2 py-1.5 flex items-center justify-center ${
                currentView === 'timeGridWeek'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setCurrentView('timeGridDay');
                calendarRef.current?.getApi().changeView('timeGridDay');
              }}
              title="Dagweergave"
              className={`px-2 py-1.5 flex items-center justify-center border-l border-gray-300 dark:border-gray-600 ${
                currentView === 'timeGridDay'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Calendar className="h-4 w-4" />
            </button>
          </div>

          {/* Mobile sidebar toggle */}
          {unscheduledTasks.length > 0 && (
            <button
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm font-medium"
            >
              <AlertTriangle className="h-4 w-4" />
              {unscheduledTasks.length}
            </button>
          )}
        </div>
      </div>

      {/* Scheduling reminder banner */}
      {schedulingReminder && (
        <div className={`rounded-lg p-3 flex items-center gap-3 ${
          schedulingReminder.level === 'overdue'
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            : schedulingReminder.level === 'strong'
              ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
              : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
        }`}>
          <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${
            schedulingReminder.level === 'overdue' ? 'text-red-600' : schedulingReminder.level === 'strong' ? 'text-amber-600' : 'text-blue-600'
          }`} />
          <p className={`text-sm font-medium ${
            schedulingReminder.level === 'overdue' ? 'text-red-800 dark:text-red-300' : schedulingReminder.level === 'strong' ? 'text-amber-800 dark:text-amber-300' : 'text-blue-800 dark:text-blue-300'
          }`}>
            {schedulingReminder.level === 'overdue'
              ? `Deadline verstreken! ${schedulingReminder.count} taken niet ingepland.`
              : schedulingReminder.level === 'strong'
                ? `Morgen is de deadline! Plan je ${schedulingReminder.count} taken in voor vrijdag 19:00.`
                : `${schedulingReminder.count} taken moeten nog ingepland worden deze week.`}
          </p>
        </div>
      )}

      {/* Main content: Sidebar + Calendar */}
      <div className="flex gap-4">
        {/* Desktop Sidebar */}
        <div ref={sidebarRef} className="hidden lg:block w-72 flex-shrink-0">
          <Card className="h-[calc(100vh-250px)] overflow-hidden !p-0">
            <TaskScheduleSidebar
              tasks={unscheduledTasks}
              onTaskClick={handleSidebarTaskClick}
              fridayDeadline={fridayDeadline}
            />
          </Card>
        </div>

        {/* Calendar */}
        <div className="flex-1 min-w-0">
          <Card className="employee-agenda-calendar">
            <FullCalendar
              ref={calendarRef}
              plugins={[timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              locale="nl"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: '',
              }}
              buttonText={{ today: 'Vandaag' }}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              slotDuration="00:30:00"
              slotLabelInterval="01:00:00"
              slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              allDaySlot={true}
              allDayText="Hele dag"
              weekNumbers={true}
              weekNumberFormat={{ week: 'numeric' }}
              firstDay={1}
              weekends={false}
              nowIndicator={true}
              editable={true}
              droppable={true}
              selectable={true}
              selectMirror={true}
              eventResizableFromStart={true}
              events={getCalendarEvents()}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              eventReceive={handleEventReceive}
              drop={handleDrop}
              select={handleDateSelect}
              height="auto"
              expandRows={true}
              dayMaxEvents={3}
              eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            />
          </Card>
        </div>
      </div>

      {/* Mobile Sidebar (bottom sheet) */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileSidebar(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl max-h-[70vh] overflow-hidden shadow-xl">
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mt-3" />
            <TaskScheduleSidebar
              tasks={unscheduledTasks}
              onTaskClick={handleSidebarTaskClick}
              fridayDeadline={fridayDeadline}
            />
          </div>
        </div>
      )}

      {/* Click-to-schedule modal */}
      {schedulingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSchedulingTask(null)}>
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{schedulingTask.title}</h3>
              {schedulingTask.internalProjectName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 mt-1">
                  {schedulingTask.internalProjectName}
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Datum</label>
                <input
                  type="date"
                  value={scheduleDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Begintijd</label>
                  <input
                    type="time"
                    value={scheduleStartTime}
                    onChange={(e) => setScheduleStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Eindtijd</label>
                  <input
                    type="time"
                    value={scheduleEndTime}
                    onChange={(e) => setScheduleEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setSchedulingTask(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleScheduleSubmit}
                disabled={!scheduleDate}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Inplannen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Popover */}
      {selectedTask && (
        <div className="fixed inset-0 z-40" onClick={() => setSelectedTask(null)}>
          <div
            className="absolute"
            style={{ top: popoverPosition.top, left: popoverPosition.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <ScheduledTaskPopover
              task={selectedTask}
              onClose={() => setSelectedTask(null)}
              onUnschedule={handleUnschedule}
              onStatusChange={handleStatusChange}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeAgenda;
