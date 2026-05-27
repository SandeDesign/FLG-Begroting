import { BusinessTask, TaskStatus } from '../types';

export interface TaskCompletionPatch {
  completedByUsers: string[];
  status: TaskStatus;
  completedDate?: Date;
}

/**
 * Berekent de update voor het (de-)markeren van een taak als voltooid door één
 * persoon. Werkt voor zowel enkel- als gedeeld-toegewezen taken.
 *
 * Belangrijk: `selfId` MOET in dezelfde id-ruimte zitten als `task.assignedTo`.
 * Medewerkers gebruiken hun employee doc-ID (currentEmployeeId), admins/managers
 * gebruiken hun auth-UID — exact zoals taken worden toegewezen. Voorheen mengden
 * de twee schermen UID en employee-ID waardoor `allDone` nooit klopte.
 */
export function computeTaskCompletionPatch(
  task: Pick<BusinessTask, 'assignedTo' | 'completedByUsers' | 'status'>,
  selfId: string,
  completed: boolean
): TaskCompletionPatch {
  const assignedTo = task.assignedTo || [];
  const current = task.completedByUsers || [];

  const completedByUsers = completed
    ? Array.from(new Set([...current, selfId]))
    : current.filter((id) => id !== selfId);

  let status: TaskStatus;
  if (assignedTo.length <= 1) {
    status = completed ? 'completed' : task.status === 'completed' ? 'pending' : task.status;
  } else {
    const allDone = assignedTo.every((id) => completedByUsers.includes(id));
    status = allDone ? 'completed' : task.status === 'completed' ? 'pending' : task.status;
  }

  const patch: TaskCompletionPatch = { completedByUsers, status };
  if (status === 'completed') patch.completedDate = new Date();
  return patch;
}

/** Of een taak voor een specifieke persoon als voltooid telt. */
export function isTaskCompletedForUser(
  task: Pick<BusinessTask, 'assignedTo' | 'completedByUsers' | 'status'>,
  selfId: string
): boolean {
  const assignedTo = task.assignedTo || [];
  if (assignedTo.length > 1) {
    return (task.completedByUsers || []).includes(selfId);
  }
  return task.status === 'completed';
}
