const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const ROTATION_GRACE_DAYS = 7;

export interface RotationDeadline {
  resourceName: string;
  dueDate: Date;
}

export interface UnverifiableRotation {
  resourceName: string;
  reason: string;
}

export type RotationStatus = RotationDeadline | UnverifiableRotation;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_IN_MS);
}

export function earliestDate(dates: (Date | undefined)[]): Date | undefined {
  const times = dates
    .filter((date): date is Date => date !== undefined)
    .map((date) => date.getTime());

  return times.length > 0 ? new Date(Math.min(...times)) : undefined;
}

function isDeadline(status: RotationStatus): status is RotationDeadline {
  return "dueDate" in status;
}

function isUnverifiable(
  status: RotationStatus,
): status is UnverifiableRotation {
  return "reason" in status;
}

export function selectOverdue(
  statuses: RotationStatus[],
  now: Date,
): RotationDeadline[] {
  return statuses
    .filter(isDeadline)
    .filter(({ dueDate }) => addDays(dueDate, ROTATION_GRACE_DAYS) < now);
}

export function selectUnverifiable(
  statuses: RotationStatus[],
): UnverifiableRotation[] {
  return statuses.filter(isUnverifiable);
}
