import { listSecretVersions } from "../aws/secrets-manager";
import type { ManualRotationSecret } from "../config";
import { addDays, type RotationDeadline } from "./deadline";

async function getManualRotationDeadline({
  secretId,
  cadenceDays,
}: ManualRotationSecret): Promise<RotationDeadline> {
  const versions = await listSecretVersions(secretId);
  const currentVersion = versions.find(({ VersionStages }) =>
    VersionStages?.includes("AWSCURRENT"),
  );

  return {
    secret: secretId,
    dueDate: currentVersion?.CreatedDate
      ? addDays(currentVersion.CreatedDate, cadenceDays)
      : undefined,
  };
}

export function getManualRotationDeadlines(
  secrets: ManualRotationSecret[],
): Promise<RotationDeadline[]> {
  return Promise.all(secrets.map(getManualRotationDeadline));
}
