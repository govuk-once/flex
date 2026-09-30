import {
  CloudWatchClient,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";

import { METRIC_NAMESPACE, type MetricName } from "../metrics";

const client = new CloudWatchClient({});

export async function publishMetric(
  environment: string,
  metricName: MetricName,
  value: number,
): Promise<void> {
  await client.send(
    new PutMetricDataCommand({
      Namespace: METRIC_NAMESPACE,
      MetricData: [
        {
          MetricName: metricName,
          Dimensions: [{ Name: "Environment", Value: environment }],
          Value: value,
          Unit: "Count",
        },
      ],
    }),
  );
}
