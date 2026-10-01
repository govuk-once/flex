import {
  CloudWatchClient,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import { mockClient } from "aws-sdk-client-mock";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { METRIC_NAMESPACE, MetricName } from "../metrics";
import { publishMetric } from "./cloudwatch";

const cloudWatch = mockClient(CloudWatchClient);

describe("publishMetric", () => {
  beforeEach(() => {
    cloudWatch.reset();
  });

  afterAll(() => {
    cloudWatch.restore();
  });

  it("publishes a count to the credentials namespace with the environment dimension", async () => {
    cloudWatch.on(PutMetricDataCommand).resolves({});

    await publishMetric("staging", MetricName.SecretRotationOverdue, 3);

    expect(
      cloudWatch.commandCalls(PutMetricDataCommand)[0]?.args[0].input,
    ).toEqual({
      Namespace: METRIC_NAMESPACE,
      MetricData: [
        {
          MetricName: "SecretRotationOverdue",
          Dimensions: [{ Name: "Environment", Value: "staging" }],
          Value: 3,
          Unit: "Count",
        },
      ],
    });
  });

  it("uses the Flex/Credentials namespace the alarms and IAM condition expect", () => {
    expect(METRIC_NAMESPACE).toBe("Flex/Credentials");
  });

  it("propagates a failure", async () => {
    cloudWatch.on(PutMetricDataCommand).rejects(new Error("Throttling"));

    await expect(
      publishMetric("staging", MetricName.CognitoConfigDrift, 0),
    ).rejects.toThrow("Throttling");
  });
});
