import { logger } from "@flex/logging";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { publishMetric } from "./aws/cloudwatch";
import { checkCognitoDrift } from "./checks/cognito-drift";
import { checkSecretRotation } from "./checks/secret-rotation";
import { handler } from "./handler";
import { MetricName } from "./metrics";

vi.mock("@flex/logging");
vi.mock("./aws/cloudwatch");
vi.mock("./checks/cognito-drift");
vi.mock("./checks/secret-rotation");

const authorizerFunctionArn =
  "arn:aws:lambda:eu-west-2:123456789012:function:authorizer";
const maximumAgeSecrets = [{ secretId: "udp", maxAgeDays: 90 }]; // pragma: allowlist secret
const cognitoParameters = [
  {
    parameterName: "/staging/flex-param/auth/client-id",
    environmentVariable: "CLIENT_ID",
  },
];

describe("handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AWS_REGION", "eu-west-2");
    vi.stubEnv("FLEX_ENVIRONMENT", "staging");
    vi.stubEnv("AUTHORIZER_FUNCTION_ARN", authorizerFunctionArn);
    vi.stubEnv("MAXIMUM_ROTATION_INTERVAL_DAYS", "90");
    vi.stubEnv("MAXIMUM_AGE_SECRETS", JSON.stringify(maximumAgeSecrets));
    vi.stubEnv("COGNITO_PARAMETERS", JSON.stringify(cognitoParameters));
    vi.mocked(checkSecretRotation).mockResolvedValue();
    vi.mocked(checkCognitoDrift).mockResolvedValue();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("runs both checks with the configuration", async () => {
    await handler();

    expect(checkSecretRotation).toHaveBeenCalledWith({
      environment: "staging",
      region: "eu-west-2",
      maximumIntervalDays: 90,
      maximumAgeSecrets,
      now: expect.any(Date) as Date,
    });
    expect(checkCognitoDrift).toHaveBeenCalledWith({
      environment: "staging",
      authorizerFunctionArn,
      cognitoParameters,
    });
  });

  it("publishes a successful run when both checks succeed", async () => {
    await handler();

    expect(publishMetric).toHaveBeenCalledWith(
      "staging",
      MetricName.CredentialMonitorSuccess,
      1,
    );
  });

  it("still runs the other check when one fails, then fails without publishing success", async () => {
    const failure = new Error("AccessDeniedException");
    vi.mocked(checkSecretRotation).mockRejectedValueOnce(failure);

    await expect(handler()).rejects.toThrow(AggregateError);

    expect(checkCognitoDrift).toHaveBeenCalledOnce();
    expect(publishMetric).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "Credential monitor checks failed",
      { failures: [failure] },
    );
  });

  it("collects every failure", async () => {
    vi.mocked(checkSecretRotation).mockRejectedValueOnce(new Error("first"));
    vi.mocked(checkCognitoDrift).mockRejectedValueOnce(new Error("second"));

    const error: unknown = await handler().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toHaveLength(2);
  });

  it("fails before running any check when the configuration is invalid", async () => {
    vi.stubEnv("COGNITO_PARAMETERS", "not json");

    await expect(handler()).rejects.toThrow();

    expect(checkSecretRotation).not.toHaveBeenCalled();
    expect(checkCognitoDrift).not.toHaveBeenCalled();
    expect(publishMetric).not.toHaveBeenCalled();
  });
});
