import { logger } from "@flex/logging";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { publishMetric } from "../aws/cloudwatch";
import { listSecrets, listSecretVersions } from "../aws/secrets-manager";
import { MetricName } from "../metrics";
import { addDays } from "../rotation/deadline";
import { checkSecretRotation } from "./secret-rotation";

vi.mock("@flex/logging");
vi.mock("../aws/cloudwatch");
vi.mock("../aws/secrets-manager");

const now = new Date("2026-09-30T12:00:00.000Z");

class NamedError extends Error {
  constructor(name: string) {
    super(`${name} raised`);
    this.name = name;
  }
}

const udpMaximumAge = [{ secretId: "udp", maxAgeDays: 90 }]; // pragma: allowlist secret

function runCheck(maximumAgeSecrets = udpMaximumAge) {
  return checkSecretRotation({
    environment: "staging",
    region: "eu-west-2",
    maximumIntervalDays: 90,
    maximumAgeSecrets,
    now,
  });
}

describe("checkSecretRotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listSecrets).mockResolvedValue([]);
    vi.mocked(listSecretVersions).mockResolvedValue([
      { VersionStages: ["AWSCURRENT"], CreatedDate: addDays(now, -10) },
    ]);
  });

  it("publishes zero for both metrics when everything is in date", async () => {
    await runCheck();

    expect(publishMetric).toHaveBeenCalledWith(
      "staging",
      MetricName.SecretRotationOverdue,
      0,
    );
    expect(publishMetric).toHaveBeenCalledWith(
      "staging",
      MetricName.SecretRotationUnverifiable,
      0,
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("counts overdue credentials from both automatic and maximum-age checks", async () => {
    vi.mocked(listSecrets).mockResolvedValueOnce([
      {
        Name: "/staging/flex-secret/rotating",
        RotationEnabled: true,
        NextRotationDate: addDays(now, -20),
        LastRotatedDate: addDays(now, -50),
      },
    ]);
    vi.mocked(listSecretVersions).mockResolvedValueOnce([
      { VersionStages: ["AWSCURRENT"], CreatedDate: addDays(now, -120) },
    ]);

    await runCheck();

    expect(publishMetric).toHaveBeenCalledWith(
      "staging",
      MetricName.SecretRotationOverdue,
      2,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Credentials are more than 7 days past their rotation date",
      {
        overdue: [
          {
            resourceName: "/staging/flex-secret/rotating",
            dueDate: addDays(now, -20).toISOString(),
          },
          { resourceName: "udp", dueDate: addDays(now, -30).toISOString() },
        ],
      },
    );
  });

  it("reports unreadable credentials as unverifiable and still publishes the overdue count", async () => {
    vi.mocked(listSecretVersions)
      .mockRejectedValueOnce(new NamedError("AccessDeniedException"))
      .mockResolvedValueOnce([
        { VersionStages: ["AWSCURRENT"], CreatedDate: addDays(now, -120) },
      ]);

    await runCheck([
      { secretId: "uns", maxAgeDays: 90 }, // pragma: allowlist secret
      { secretId: "udp", maxAgeDays: 90 }, // pragma: allowlist secret
    ]);

    expect(publishMetric).toHaveBeenCalledWith(
      "staging",
      MetricName.SecretRotationOverdue,
      1,
    );
    expect(publishMetric).toHaveBeenCalledWith(
      "staging",
      MetricName.SecretRotationUnverifiable,
      1,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Rotation status could not be determined for some credentials",
      {
        unverifiable: [
          { resourceName: "uns", reason: "AccessDeniedException" },
        ],
      },
    );
  });

  it("logs under keys the shared log sanitiser does not redact", async () => {
    vi.mocked(listSecretVersions).mockResolvedValueOnce([
      { VersionStages: ["AWSCURRENT"], CreatedDate: addDays(now, -120) },
    ]);

    await runCheck();

    const details = vi
      .mocked(logger.warn)
      .mock.calls.flatMap(([, detail]) => JSON.stringify(detail));

    details.forEach((detail) => {
      expect(detail).not.toMatch(/"[^"]*(secret|token|credential)[^"]*":/i);
    });
  });

  it("fails without publishing when the secrets cannot be listed", async () => {
    vi.mocked(listSecrets).mockRejectedValueOnce(
      new Error("AccessDeniedException"),
    );

    await expect(runCheck()).rejects.toThrow("AccessDeniedException");
    expect(publishMetric).not.toHaveBeenCalled();
  });
});
