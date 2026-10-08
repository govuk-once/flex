import { beforeEach, describe, expect, it, vi } from "vitest";

import { listSecretVersions } from "../aws/secrets-manager";
import { addDays } from "./deadline";
import { getMaximumAgeStatuses } from "./maximum-age";

vi.mock("../aws/secrets-manager");

const currentCreated = new Date("2026-07-01T00:00:00.000Z");
const previousCreated = new Date("2026-04-01T00:00:00.000Z");

class NamedError extends Error {
  constructor(name: string) {
    super(`${name} raised`);
    this.name = name;
  }
}

describe("getMaximumAgeStatuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dates the deadline from the AWSCURRENT version", async () => {
    vi.mocked(listSecretVersions).mockResolvedValueOnce([
      {
        VersionId: "old",
        VersionStages: ["AWSPREVIOUS"],
        CreatedDate: previousCreated,
      },
      {
        VersionId: "new",
        VersionStages: ["AWSCURRENT"],
        CreatedDate: currentCreated,
      },
    ]);

    await expect(
      getMaximumAgeStatuses([{ secretId: "udp-secret-arn", maxAgeDays: 90 }]), // pragma: allowlist secret
    ).resolves.toEqual([
      { resourceName: "udp-secret-arn", dueDate: addDays(currentCreated, 90) },
    ]);
    expect(listSecretVersions).toHaveBeenCalledWith("udp-secret-arn");
  });

  it("uses each secret's own maximum age", async () => {
    vi.mocked(listSecretVersions).mockResolvedValue([
      { VersionStages: ["AWSCURRENT"], CreatedDate: currentCreated },
    ]);

    await expect(
      getMaximumAgeStatuses([
        { secretId: "a", maxAgeDays: 30 },
        { secretId: "b", maxAgeDays: 90 },
      ]),
    ).resolves.toEqual([
      { resourceName: "a", dueDate: addDays(currentCreated, 30) },
      { resourceName: "b", dueDate: addDays(currentCreated, 90) },
    ]);
  });

  it("reports a secret without an AWSCURRENT version as unverifiable", async () => {
    vi.mocked(listSecretVersions).mockResolvedValueOnce([
      { VersionStages: ["AWSPREVIOUS"], CreatedDate: previousCreated },
    ]);

    await expect(
      getMaximumAgeStatuses([{ secretId: "a", maxAgeDays: 90 }]),
    ).resolves.toEqual([
      { resourceName: "a", reason: "no AWSCURRENT version was found" },
    ]);
  });

  it("reports an AWSCURRENT version without a creation date as unverifiable", async () => {
    vi.mocked(listSecretVersions).mockResolvedValueOnce([
      { VersionStages: ["AWSCURRENT"] },
    ]);

    await expect(
      getMaximumAgeStatuses([{ secretId: "a", maxAgeDays: 90 }]),
    ).resolves.toEqual([
      { resourceName: "a", reason: "no AWSCURRENT version was found" },
    ]);
  });

  it("reports an unreadable secret as unverifiable without failing the others", async () => {
    vi.mocked(listSecretVersions)
      .mockRejectedValueOnce(new NamedError("ResourceNotFoundException"))
      .mockResolvedValueOnce([
        { VersionStages: ["AWSCURRENT"], CreatedDate: currentCreated },
      ]);

    await expect(
      getMaximumAgeStatuses([
        { secretId: "missing", maxAgeDays: 90 }, // pragma: allowlist secret
        { secretId: "present", maxAgeDays: 90 }, // pragma: allowlist secret
      ]),
    ).resolves.toEqual([
      { resourceName: "missing", reason: "ResourceNotFoundException" },
      { resourceName: "present", dueDate: addDays(currentCreated, 90) },
    ]);
  });

  it("records an unknown error when the failure is not an Error", async () => {
    vi.mocked(listSecretVersions).mockRejectedValueOnce("timeout");

    await expect(
      getMaximumAgeStatuses([{ secretId: "a", maxAgeDays: 90 }]),
    ).resolves.toEqual([{ resourceName: "a", reason: "unknown error" }]);
  });

  it("returns an empty list when no secrets are configured", async () => {
    await expect(getMaximumAgeStatuses([])).resolves.toEqual([]);
    expect(listSecretVersions).not.toHaveBeenCalled();
  });
});
