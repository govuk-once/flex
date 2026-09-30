import type { SecretListEntry } from "@aws-sdk/client-secrets-manager";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listSecrets } from "../aws/secrets-manager";
import { getAutomaticRotationStatuses } from "./automatic";
import { addDays } from "./deadline";

vi.mock("../aws/secrets-manager");

const region = "eu-west-2";
const maximumIntervalDays = 90;
const lastRotated = new Date("2026-09-01T00:00:00.000Z");

function secret(overrides: Partial<SecretListEntry>): SecretListEntry {
  return {
    Name: "/staging/flex-secret/rotating",
    ARN: "arn:aws:secretsmanager:eu-west-2:123456789012:secret:/staging/flex-secret/rotating-AbCdEf",
    RotationEnabled: true,
    LastRotatedDate: lastRotated,
    RotationRules: { AutomaticallyAfterDays: 30 },
    NextRotationDate: addDays(lastRotated, 30),
    ...overrides,
  };
}

function statusesFor(secrets: SecretListEntry[]) {
  vi.mocked(listSecrets).mockResolvedValueOnce(secrets);
  return getAutomaticRotationStatuses({ region, maximumIntervalDays });
}

describe("getAutomaticRotationStatuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the next rotation date when it is within the policy", async () => {
    await expect(statusesFor([secret({})])).resolves.toEqual([
      {
        resourceName: "/staging/flex-secret/rotating",
        dueDate: addDays(lastRotated, 30),
      },
    ]);
  });

  it("ignores secrets without rotation enabled", async () => {
    await expect(
      statusesFor([
        secret({ RotationEnabled: false }),
        secret({ RotationEnabled: undefined }),
      ]),
    ).resolves.toEqual([]);
  });

  it("ignores replicas whose primary is in another region", async () => {
    await expect(
      statusesFor([secret({ PrimaryRegion: "us-east-1" })]),
    ).resolves.toEqual([]);
  });

  it("includes secrets whose primary is in this region", async () => {
    await expect(
      statusesFor([secret({ PrimaryRegion: region })]),
    ).resolves.toHaveLength(1);
  });

  it("caps a schedule longer than the policy at the maximum interval", async () => {
    await expect(
      statusesFor([
        secret({
          RotationRules: { AutomaticallyAfterDays: 365 },
          NextRotationDate: addDays(lastRotated, 365),
        }),
      ]),
    ).resolves.toEqual([
      {
        resourceName: "/staging/flex-secret/rotating",
        dueDate: addDays(lastRotated, maximumIntervalDays),
      },
    ]);
  });

  it("falls back to the last rotation plus the interval without a next rotation date", async () => {
    await expect(
      statusesFor([secret({ NextRotationDate: undefined })]),
    ).resolves.toEqual([
      {
        resourceName: "/staging/flex-secret/rotating",
        dueDate: addDays(lastRotated, 30),
      },
    ]);
  });

  it("uses the creation date for a secret that has never rotated", async () => {
    const created = new Date("2026-08-01T00:00:00.000Z");

    await expect(
      statusesFor([
        secret({
          LastRotatedDate: undefined,
          CreatedDate: created,
          NextRotationDate: undefined,
        }),
      ]),
    ).resolves.toEqual([
      {
        resourceName: "/staging/flex-secret/rotating",
        dueDate: addDays(created, 30),
      },
    ]);
  });

  it("uses the policy limit for a schedule expression without an interval", async () => {
    await expect(
      statusesFor([
        secret({
          RotationRules: { ScheduleExpression: "rate(10 days)" },
          NextRotationDate: undefined,
        }),
      ]),
    ).resolves.toEqual([
      {
        resourceName: "/staging/flex-secret/rotating",
        dueDate: addDays(lastRotated, maximumIntervalDays),
      },
    ]);
  });

  it("reports a secret with no dates at all as unverifiable", async () => {
    await expect(
      statusesFor([
        secret({
          LastRotatedDate: undefined,
          CreatedDate: undefined,
          NextRotationDate: undefined,
        }),
      ]),
    ).resolves.toEqual([
      {
        resourceName: "/staging/flex-secret/rotating",
        reason: "rotation is enabled but Secrets Manager reports no dates",
      },
    ]);
  });

  it("falls back to the ARN when a secret has no name", async () => {
    const [status] = await statusesFor([secret({ Name: undefined })]);

    expect(status?.resourceName).toBe(
      "arn:aws:secretsmanager:eu-west-2:123456789012:secret:/staging/flex-secret/rotating-AbCdEf",
    );
  });

  it("propagates a failure to list secrets", async () => {
    vi.mocked(listSecrets).mockRejectedValueOnce(
      new Error("AccessDeniedException"),
    );

    await expect(
      getAutomaticRotationStatuses({ region, maximumIntervalDays }),
    ).rejects.toThrow("AccessDeniedException");
  });
});
