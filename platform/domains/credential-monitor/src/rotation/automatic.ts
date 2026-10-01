import type { SecretListEntry } from "@aws-sdk/client-secrets-manager";

import { listSecrets } from "../aws/secrets-manager";
import { addDays, earliestDate, type RotationStatus } from "./deadline";

interface AutomaticRotationProps {
  region: string;
  maximumIntervalDays: number;
}

function isLocalPrimary(secret: SecretListEntry, region: string): boolean {
  return !secret.PrimaryRegion || secret.PrimaryRegion === region;
}

function toRotationStatus(
  secret: SecretListEntry,
  maximumIntervalDays: number,
): RotationStatus {
  const resourceName = secret.Name ?? secret.ARN ?? "unknown";
  const lastRotated = secret.LastRotatedDate ?? secret.CreatedDate;
  const intervalDays = secret.RotationRules?.AutomaticallyAfterDays;

  const scheduledDate =
    secret.NextRotationDate ??
    (lastRotated && intervalDays
      ? addDays(lastRotated, intervalDays)
      : undefined);
  const policyDate = lastRotated
    ? addDays(lastRotated, maximumIntervalDays)
    : undefined;

  const dueDate = earliestDate([scheduledDate, policyDate]);

  return dueDate
    ? { resourceName, dueDate }
    : {
        resourceName,
        reason: "rotation is enabled but Secrets Manager reports no dates",
      };
}

export async function getAutomaticRotationStatuses({
  region,
  maximumIntervalDays,
}: AutomaticRotationProps): Promise<RotationStatus[]> {
  const secrets = await listSecrets();

  return secrets
    .filter((secret) => secret.RotationEnabled)
    .filter((secret) => isLocalPrimary(secret, region))
    .map((secret) => toRotationStatus(secret, maximumIntervalDays));
}
