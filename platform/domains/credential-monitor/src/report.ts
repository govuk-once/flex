import { logger } from "@flex/logging";

import { publishMetric } from "./aws/cloudwatch";
import type { MetricName } from "./metrics";

interface ReportCountProps<T> {
  environment: string;
  metricName: MetricName;
  message: string;
  detailKey: string;
  items: T[];
}

export async function reportCount<T>({
  environment,
  metricName,
  message,
  detailKey,
  items,
}: ReportCountProps<T>): Promise<void> {
  if (items.length > 0) {
    logger.warn(message, { [detailKey]: items });
  }

  await publishMetric(environment, metricName, items.length);
}
