import { BusinessTask } from '../types';

// Werktaken moeten vóór 17:00 op hun vervaldag klaar zijn. Een taak is dus pas
// "te laat" nadat 17:00 op de dueDate is verstreken — niet al om middernacht.
export const TASK_DEADLINE_HOUR = 17;

export const getTaskDeadline = (dueDate: Date | string | number): Date => {
  const d = new Date(dueDate);
  d.setHours(TASK_DEADLINE_HOUR, 0, 0, 0);
  return d;
};

export const isTaskOverdue = (
  task: Pick<BusinessTask, 'dueDate' | 'status'>,
  now: Date = new Date()
): boolean => {
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  if (!task.dueDate) return false;
  return now > getTaskDeadline(task.dueDate);
};
