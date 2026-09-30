const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const ROTATION_GRACE_DAYS = 7;

export interface RotationDeadline {
  secret: string;
  dueDate?: Date;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_IN_MS);
}

export function selectOverdue(
  deadlines: RotationDeadline[],
  now: Date,
): RotationDeadline[] {
  return deadlines.filter(
    ({ dueDate }) => !dueDate || addDays(dueDate, ROTATION_GRACE_DAYS) < now,
  );
}
