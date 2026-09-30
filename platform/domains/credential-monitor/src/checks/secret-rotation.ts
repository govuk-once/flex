import { logger } from "@flex/logging";

import { publishMetric } from "../aws/cloudwatch";
import type { ManualRotationSecret } from "../config";
import { MetricName } from "../metrics";
import { getAutomaticRotationDeadlines } from "../rotation/automatic";
import { selectOverdue } from "../rotation/deadline";
import { getManualRotationDeadlines } from "../rotation/manual";

interface SecretRotationCheckProps {
  environment: string;
  manualRotationSecrets: ManualRotationSecret[];
  now: Date;
}

export async function checkSecretRotation({
  environment,
  manualRotationSecrets,
  now,
}: SecretRotationCheckProps): Promise<void> {
  const [automatic, manual] = await Promise.all([
    getAutomaticRotationDeadlines(),
    getManualRotationDeadlines(manualRotationSecrets),
  ]);

  const overdue = selectOverdue([...automatic, ...manual], now);

  if (overdue.length > 0) {
    logger.warn("Secrets overdue for rotation", {
      secrets: overdue.map(({ secret, dueDate }) => ({
        secret,
        dueDate: dueDate?.toISOString() ?? "unknown",
      })),
    });
  }

  await publishMetric(
    environment,
    MetricName.SecretRotationOverdue,
    overdue.length,
  );
}
