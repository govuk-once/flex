import { describe, expect, it } from "vitest";

import { putMetricDataStatement } from "./put-metric-data-statement";

describe("putMetricDataStatement", () => {
  it("allows PutMetricData only in the given namespace", () => {
    expect(putMetricDataStatement("Flex/Credentials").toJSON()).toEqual({
      Effect: "Allow",
      Action: "cloudwatch:PutMetricData",
      Resource: "*",
      Condition: {
        StringEquals: { "cloudwatch:namespace": "Flex/Credentials" },
      },
    });
  });

  it("returns a new statement for each namespace", () => {
    const smokeTest = putMetricDataStatement("Flex/SmokeTest").toJSON() as {
      Condition: unknown;
    };

    expect(smokeTest.Condition).toEqual({
      StringEquals: { "cloudwatch:namespace": "Flex/SmokeTest" },
    });
  });
});
