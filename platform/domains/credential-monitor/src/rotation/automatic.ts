import type { SecretListEntry } from "@aws-sdk/client-secrets-manager";

import { listSecrets } from "../aws/secrets-manager";
import { addDays, earliestDate, type RotationStatus } from "./deadline";

interface AutomaticRotationProps {
  region: string;
  maximumIntervalDays: number;
  namedSecretIds?: string[];
}

function isLocalPrimary(secret: SecretListEntry, region: string): boolean {
  return !secret.PrimaryRegion || secret.PrimaryRegion === region;
}

function toResourceName(
  secret: SecretListEntry,
  namedSecretIds: string[],
): string {
  const namedSecretId = [secret.ARN, secret.Name].find(
    (secretId) => secretId !== undefined && namedSecretIds.includes(secretId),
  );

  return namedSecretId ?? secret.Name ?? secret.ARN ?? "unknown";
}

function toRotationStatus(
  secret: SecretListEntry,
  maximumIntervalDays: number,
  namedSecretIds: string[],
): RotationStatus {
  const resourceName = toResourceName(secret, namedSecretIds);
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
  namedSecretIds = [],
}: AutomaticRotationProps): Promise<RotationStatus[]> {
  const secrets = await listSecrets();

  return secrets
    .filter((secret) => secret.RotationEnabled)
    .filter((secret) => isLocalPrimary(secret, region))
    .map((secret) =>
      toRotationStatus(secret, maximumIntervalDays, namedSecretIds),
    );
}
