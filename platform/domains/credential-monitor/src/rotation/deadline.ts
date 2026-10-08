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

function onePerResource<T extends { resourceName: string }>(
  statuses: T[],
  replaces: (candidate: T, kept: T) => boolean,
): T[] {
  const byResource = statuses.reduce((kept, status) => {
    const current = kept.get(status.resourceName);

    return !current || replaces(status, current)
      ? kept.set(status.resourceName, status)
      : kept;
  }, new Map<string, T>());

  return [...byResource.values()];
}

export function selectOverdue(
  statuses: RotationStatus[],
  now: Date,
): RotationDeadline[] {
  return onePerResource(
    statuses
      .filter(isDeadline)
      .filter(({ dueDate }) => addDays(dueDate, ROTATION_GRACE_DAYS) < now),
    (candidate, kept) => candidate.dueDate < kept.dueDate,
  );
}

export function selectUnverifiable(
  statuses: RotationStatus[],
): UnverifiableRotation[] {
  return onePerResource(statuses.filter(isUnverifiable), () => false);
}
