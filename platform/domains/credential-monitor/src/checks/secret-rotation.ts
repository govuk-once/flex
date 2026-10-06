import type { MaximumAgeSecret } from "../config";
import { MetricName } from "../metrics";
import { reportCount } from "../report";
import { getAutomaticRotationStatuses } from "../rotation/automatic";
import { selectOverdue, selectUnverifiable } from "../rotation/deadline";
import { getMaximumAgeStatuses } from "../rotation/maximum-age";

interface SecretRotationCheckProps {
  environment: string;
  region: string;
  maximumIntervalDays: number;
  maximumAgeSecrets: MaximumAgeSecret[];
  now: Date;
}

export async function checkSecretRotation({
  environment,
  region,
  maximumIntervalDays,
  maximumAgeSecrets,
  now,
}: SecretRotationCheckProps): Promise<void> {
  const [automatic, maximumAge] = await Promise.all([
    getAutomaticRotationStatuses({
      region,
      maximumIntervalDays,
      excludedSecretIds: maximumAgeSecrets.map(({ secretId }) => secretId),
    }),
    getMaximumAgeStatuses(maximumAgeSecrets),
  ]);

  const statuses = [...automatic, ...maximumAge];

  await Promise.all([
    reportCount({
      environment,
      metricName: MetricName.SecretRotationOverdue,
      message: "Credentials are more than 7 days past their rotation date",
      detailKey: "overdue",
      items: selectOverdue(statuses, now).map(({ resourceName, dueDate }) => ({
        resourceName,
        dueDate: dueDate.toISOString(),
      })),
    }),
    reportCount({
      environment,
      metricName: MetricName.SecretRotationUnverifiable,
      message: "Rotation status could not be determined for some credentials",
      detailKey: "unverifiable",
      items: selectUnverifiable(statuses),
    }),
  ]);
}
