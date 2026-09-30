import { describe, expect, it } from "vitest";

import {
  addDays,
  earliestDate,
  ROTATION_GRACE_DAYS,
  type RotationStatus,
  selectOverdue,
  selectUnverifiable,
} from "./deadline";

const now = new Date("2026-09-30T12:00:00.000Z");

describe("addDays", () => {
  it("adds whole days", () => {
    expect(addDays(now, 3).toISOString()).toBe("2026-10-03T12:00:00.000Z");
  });

  it("subtracts with a negative number of days", () => {
    expect(addDays(now, -30).toISOString()).toBe("2026-08-31T12:00:00.000Z");
  });

  it("does not modify the date it is given", () => {
    const date = new Date(now);

    addDays(date, 5);

    expect(date).toEqual(now);
  });
});

describe("earliestDate", () => {
  it("returns the earliest of the dates", () => {
    expect(
      earliestDate([addDays(now, 5), addDays(now, -2), addDays(now, 1)]),
    ).toEqual(addDays(now, -2));
  });

  it("ignores undefined entries", () => {
    expect(earliestDate([undefined, addDays(now, 4), undefined])).toEqual(
      addDays(now, 4),
    );
  });

  it("returns undefined when there is no date", () => {
    expect(earliestDate([undefined, undefined])).toBeUndefined();
    expect(earliestDate([])).toBeUndefined();
  });
});

describe("selectOverdue", () => {
  it("uses a 7-day grace period", () => {
    expect(ROTATION_GRACE_DAYS).toBe(7);
  });

  it("selects deadlines more than the grace period in the past", () => {
    const statuses: RotationStatus[] = [
      { resourceName: "long-overdue", dueDate: addDays(now, -30) },
      { resourceName: "just-overdue", dueDate: addDays(now, -8) },
    ];

    expect(selectOverdue(statuses, now)).toEqual(statuses);
  });

  it("does not select deadlines within the grace period", () => {
    const statuses: RotationStatus[] = [
      { resourceName: "in-grace", dueDate: addDays(now, -6) },
      { resourceName: "due-today", dueDate: now },
      { resourceName: "future", dueDate: addDays(now, 10) },
    ];

    expect(selectOverdue(statuses, now)).toEqual([]);
  });

  it("does not select a deadline exactly at the end of the grace period", () => {
    const statuses: RotationStatus[] = [
      { resourceName: "boundary", dueDate: addDays(now, -ROTATION_GRACE_DAYS) },
    ];

    expect(selectOverdue(statuses, now)).toEqual([]);
  });

  it("never selects an unverifiable status", () => {
    const statuses: RotationStatus[] = [
      { resourceName: "unreadable", reason: "AccessDeniedException" },
    ];

    expect(selectOverdue(statuses, now)).toEqual([]);
  });
});

describe("selectUnverifiable", () => {
  it("selects only statuses with a reason", () => {
    const unverifiable = {
      resourceName: "unreadable",
      reason: "ResourceNotFoundException",
    };
    const statuses: RotationStatus[] = [
      { resourceName: "overdue", dueDate: addDays(now, -30) },
      unverifiable,
    ];

    expect(selectUnverifiable(statuses)).toEqual([unverifiable]);
  });

  it("returns an empty list when every status has a date", () => {
    expect(
      selectUnverifiable([{ resourceName: "fine", dueDate: now }]),
    ).toEqual([]);
  });
});
