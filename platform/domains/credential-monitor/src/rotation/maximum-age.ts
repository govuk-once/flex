import { listSecretVersions } from "../aws/secrets-manager";
import type { MaximumAgeSecret } from "../config";
import { addDays, type RotationStatus } from "./deadline";

async function getMaximumAgeStatus({
  secretId,
  maxAgeDays,
}: MaximumAgeSecret): Promise<RotationStatus> {
  const versions = await listSecretVersions(secretId);
  const currentVersion = versions.find(({ VersionStages }) =>
    VersionStages?.includes("AWSCURRENT"),
  );

  return currentVersion?.CreatedDate
    ? {
        resourceName: secretId,
        dueDate: addDays(currentVersion.CreatedDate, maxAgeDays),
      }
    : { resourceName: secretId, reason: "no AWSCURRENT version was found" };
}

function toUnverifiable(secretId: string, error: unknown): RotationStatus {
  return {
    resourceName: secretId,
    reason: error instanceof Error ? error.name : "unknown error",
  };
}

export function getMaximumAgeStatuses(
  secrets: MaximumAgeSecret[],
): Promise<RotationStatus[]> {
  return Promise.all(
    secrets.map((secret) =>
      getMaximumAgeStatus(secret).catch((error: unknown) =>
        toUnverifiable(secret.secretId, error),
      ),
    ),
  );
}
