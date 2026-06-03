import React from 'react';
import { X, Clock, MapPin, ExternalLink, CalendarX, CheckCircle2 } from 'lucide-react';
import { BusinessTask } from '../../types';
import { MicrosoftCalendarEvent } from '../../types/microsoft';
import { PRIORITY_CONFIG, CATEGORY_CONFIG, FREQUENCY_CONFIG } from '../../utils/taskConfig';
import Button from '../ui/Button';

interface ScheduledTaskPopoverProps {
  task?: BusinessTask;
  microsoftEvent?: MicrosoftCalendarEvent;
  onClose: () => void;
  onUnschedule?: (taskId: string) => void;
  onStatusChange?: (taskId: string, status: 'completed') => void;
}

const ScheduledTaskPopover: React.FC<ScheduledTaskPopoverProps> = ({
  task,
  microsoftEvent,
  onClose,
  onUnschedule,
  onStatusChange,
}) => {
  if (microsoftEvent) {
    const startTime = new Date(microsoftEvent.start.dateTime);
    const endTime = new Date(microsoftEvent.end.dateTime);

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-sm w-full">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              {microsoftEvent.subject}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <Clock className="h-4 w-4" />
            <span>
              {startTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
              {' - '}
              {endTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {microsoftEvent.location?.displayName && (
            <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
              <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p>{microsoftEvent.location.displayName}</p>
                {microsoftEvent.location.address && (
                  <p className="text-xs text-gray-500">
                    {microsoftEvent.location.address.street}, {microsoftEvent.location.address.city}
                    {microsoftEvent.location.address.postalCode && ` ${microsoftEvent.location.address.postalCode}`}
                  </p>
                )}
              </div>
            </div>
          )}

          {microsoftEvent.bodyPreview && (
            <p className="text-gray-500 dark:text-gray-300 text-xs mt-2 line-clamp-3">
              {microsoftEvent.bodyPreview}
            </p>
          )}

          {microsoftEvent.webLink && (
            <a
              href={microsoftEvent.webLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline mt-2"
            >
              <ExternalLink className="h-3 w-3" />
              Openen in Outlook
            </a>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            Microsoft Kalender
          </span>
        </div>
      </div>
    );
  }

  if (!task) return null;

  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const categoryConfig = CATEGORY_CONFIG[task.category];
  const frequencyConfig = task.frequency ? FREQUENCY_CONFIG[task.frequency] : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-sm w-full">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm pr-2">{task.title}</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex-shrink-0">
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${categoryConfig.color}`}>
          {categoryConfig.label}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${priorityConfig.color}`}>
          {priorityConfig.label}
        </span>
        {frequencyConfig && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${frequencyConfig.bgColor}`}>
            {frequencyConfig.label}
          </span>
        )}
      </div>

      {/* Tijd */}
      {task.scheduledStartTime && task.scheduledEndTime && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2">
          <Clock className="h-4 w-4" />
          <span>{task.scheduledStartTime} - {task.scheduledEndTime}</span>
        </div>
      )}

      {/* Beschrijving */}
      {task.description && (
        <p className="text-xs text-gray-500 dark:text-gray-300 mb-3 line-clamp-3">
          {task.description}
        </p>
      )}

      {/* Checklist progress */}
      {task.checklist && task.checklist.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-300 mb-1">
            <span>Subtaken</span>
            <span>{task.checklist.filter(s => s.completed).length}/{task.checklist.length}</span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${task.progress || 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
        {onUnschedule && (
          <Button
            variant="secondary"
            onClick={() => onUnschedule(task.id)}
            icon={CalendarX}
            className="text-xs flex-1"
          >
            Herplannen
          </Button>
        )}
        {onStatusChange && task.status !== 'completed' && (
          <Button
            onClick={() => onStatusChange(task.id, 'completed')}
            icon={CheckCircle2}
            className="text-xs flex-1"
          >
            Voltooid
          </Button>
        )}
      </div>
    </div>
  );
};

export default ScheduledTaskPopover;
