import React from 'react';
import { GripVertical, AlertTriangle, CalendarDays, Clock, CalendarRange, Repeat, Calendar } from 'lucide-react';
import { BusinessTask } from '../../types';
import { PRIORITY_CONFIG, FREQUENCY_CONFIG } from '../../utils/taskConfig';

interface TaskScheduleSidebarProps {
  tasks: BusinessTask[];
  onTaskClick: (task: BusinessTask) => void;
  fridayDeadline: Date;
}

const TaskScheduleSidebar: React.FC<TaskScheduleSidebarProps> = ({ tasks, onTaskClick, fridayDeadline }) => {
  const now = new Date();
  const isDeadlineNear = fridayDeadline.getTime() - now.getTime() < 48 * 60 * 60 * 1000; // minder dan 48 uur
  const isOverdue = now > fridayDeadline;

  // Groepeer per frequentie
  const grouped = {
    daily: tasks.filter(t => t.isRecurring && t.frequency === 'daily'),
    weekly: tasks.filter(t => t.isRecurring && t.frequency === 'weekly'),
    monthly: tasks.filter(t => t.isRecurring && (t.frequency === 'monthly' || t.frequency === 'quarterly' || t.frequency === 'yearly')),
    once: tasks.filter(t => !t.isRecurring),
  };

  const renderTaskItem = (task: BusinessTask) => {
    const priorityConfig = PRIORITY_CONFIG[task.priority];

    const taskColor = task.priority === 'urgent' ? '#ef4444'
      : task.priority === 'high' ? '#f97316'
      : task.priority === 'medium' ? '#3b82f6'
      : '#6b7280';

    return (
      <div
        key={task.id}
        data-task-id={task.id}
        data-task-title={task.title}
        data-task-color={taskColor}
        onClick={() => onTaskClick(task)}
        className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
      >
        <GripVertical className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0 opacity-50 group-hover:opacity-100" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{task.title}</p>
          {task.internalProjectName && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 mt-0.5">
              {task.internalProjectName}
            </span>
          )}
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityConfig.color}`}>
              {priorityConfig.label}
            </span>
            {task.dueDate && (
              <span className="text-[10px] text-gray-500 dark:text-gray-300">
                {new Date(task.dueDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
              </span>
            )}
            {task.estimatedHours && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                <Clock className="h-2.5 w-2.5" />
                ~{task.estimatedHours}u
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderGroup = (title: string, icon: React.ReactNode, taskList: BusinessTask[]) => {
    if (taskList.length === 0) return null;

    return (
      <div className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
          {icon}
          {title} ({taskList.length})
        </h4>
        <div className="space-y-1.5">
          {taskList.map(renderTaskItem)}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          In te plannen ({tasks.length})
        </h3>
        {tasks.length > 0 && (
          <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
            isOverdue
              ? 'text-red-600 dark:text-red-400'
              : isDeadlineNear
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-gray-500 dark:text-gray-300'
          }`}>
            {(isOverdue || isDeadlineNear) && <AlertTriangle className="h-3.5 w-3.5" />}
            Deadline: vrijdag 19:00
          </div>
        )}
      </div>

      {/* Tasks list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-300">Alle taken zijn ingepland</p>
          </div>
        ) : (
          <>
            {renderGroup('Dagelijks', <Clock className="h-3.5 w-3.5" />, grouped.daily)}
            {renderGroup('Wekelijks', <CalendarDays className="h-3.5 w-3.5" />, grouped.weekly)}
            {renderGroup('Maandelijks+', <CalendarRange className="h-3.5 w-3.5" />, grouped.monthly)}
            {renderGroup('Eenmalig', <Repeat className="h-3.5 w-3.5" />, grouped.once)}
          </>
        )}
      </div>

      {/* Drag hint */}
      {tasks.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-[11px] text-gray-500 dark:text-gray-300 text-center">
            Sleep taken naar de kalender om in te plannen
          </p>
        </div>
      )}
    </div>
  );
};

export default TaskScheduleSidebar;
