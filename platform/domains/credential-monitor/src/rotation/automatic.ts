import type { SecretListEntry } from "@aws-sdk/client-secrets-manager";

import { listSecrets } from "../aws/secrets-manager";
import { addDays, type RotationDeadline } from "./deadline";

function nextRotationDate(secret: SecretListEntry): Date | undefined {
  if (secret.NextRotationDate) {
    return secret.NextRotationDate;
  }

  const lastRotated = secret.LastRotatedDate ?? secret.CreatedDate;
  const intervalDays = secret.RotationRules?.AutomaticallyAfterDays;

  return lastRotated && intervalDays
    ? addDays(lastRotated, intervalDays)
    : undefined;
}

export async function getAutomaticRotationDeadlines(): Promise<
  RotationDeadline[]
> {
  const secrets = await listSecrets();

  return secrets
    .filter((secret) => secret.RotationEnabled)
    .map((secret) => ({
      secret: secret.Name ?? secret.ARN ?? "unknown",
      dueDate: nextRotationDate(secret),
    }));
}
