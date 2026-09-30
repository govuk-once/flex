import { logger } from "@flex/logging";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { publishMetric } from "./aws/cloudwatch";
import { MetricName } from "./metrics";
import { reportCount } from "./report";

vi.mock("@flex/logging");
vi.mock("./aws/cloudwatch");

describe("reportCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs the items under the detail key and publishes their count", async () => {
    const items = [{ resourceName: "a" }, { resourceName: "b" }];

    await reportCount({
      environment: "staging",
      metricName: MetricName.SecretRotationOverdue,
      message: "Overdue",
      detailKey: "overdue",
      items,
    });

    expect(logger.warn).toHaveBeenCalledWith("Overdue", { overdue: items });
    expect(publishMetric).toHaveBeenCalledWith(
      "staging",
      MetricName.SecretRotationOverdue,
      2,
    );
  });

  it("publishes zero without logging when there are no items", async () => {
    await reportCount({
      environment: "staging",
      metricName: MetricName.CognitoConfigDrift,
      message: "Drift",
      detailKey: "drifted",
      items: [],
    });

    expect(logger.warn).not.toHaveBeenCalled();
    expect(publishMetric).toHaveBeenCalledWith(
      "staging",
      MetricName.CognitoConfigDrift,
      0,
    );
  });

  it("propagates a failure to publish", async () => {
    vi.mocked(publishMetric).mockRejectedValueOnce(new Error("Throttling"));

    await expect(
      reportCount({
        environment: "staging",
        metricName: MetricName.CognitoConfigDrift,
        message: "Drift",
        detailKey: "drifted",
        items: [],
      }),
    ).rejects.toThrow("Throttling");
  });
});
