import { logger } from "@flex/logging";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { publishMetric } from "../aws/cloudwatch";
import { getFunctionEnvironment } from "../aws/lambda";
import { getParameterValue } from "../aws/ssm";
import { MetricName } from "../metrics";
import { checkCognitoDrift } from "./cognito-drift";

vi.mock("@flex/logging");
vi.mock("../aws/cloudwatch");
vi.mock("../aws/lambda");
vi.mock("../aws/ssm");

const authorizerFunctionArn =
  "arn:aws:lambda:eu-west-2:123456789012:function:staging-authorizer";

const cognitoParameters = [
  {
    parameterName: "/staging/flex-param/auth/user-pool-id",
    environmentVariable: "USERPOOL_ID",
  },
  {
    parameterName: "/staging/flex-param/auth/client-id",
    environmentVariable: "CLIENT_ID",
  },
];

const parameterValues: Record<string, string> = {
  "/staging/flex-param/auth/user-pool-id": "eu-west-2_pool",
  "/staging/flex-param/auth/client-id": "client-123",
};

function runCheck() {
  return checkCognitoDrift({
    environment: "staging",
    authorizerFunctionArn,
    cognitoParameters,
  });
}

describe("checkCognitoDrift", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getParameterValue).mockImplementation((name) =>
      Promise.resolve(parameterValues[name] ?? ""),
    );
    vi.mocked(getFunctionEnvironment).mockResolvedValue({
      USERPOOL_ID: "eu-west-2_pool",
      CLIENT_ID: "client-123",
      JWKS_URI: "https://example.com/jwks.json",
    });
  });

  it("publishes zero when the deployed values match SSM", async () => {
    await runCheck();

    expect(getFunctionEnvironment).toHaveBeenCalledWith(authorizerFunctionArn);
    expect(publishMetric).toHaveBeenCalledWith(
      "staging",
      MetricName.CognitoConfigDrift,
      0,
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("counts and logs each parameter that differs", async () => {
    vi.mocked(getFunctionEnvironment).mockResolvedValueOnce({
      USERPOOL_ID: "eu-west-2_old-pool",
      CLIENT_ID: "client-123",
    });

    await runCheck();

    expect(publishMetric).toHaveBeenCalledWith(
      "staging",
      MetricName.CognitoConfigDrift,
      1,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Cognito configuration in SSM differs from the deployed authorizer, a deployment is required",
      { drifted: [cognitoParameters[0]] },
    );
  });

  it("treats a variable missing from the authorizer as drift", async () => {
    vi.mocked(getFunctionEnvironment).mockResolvedValueOnce({
      USERPOOL_ID: "eu-west-2_pool",
    });

    await runCheck();

    expect(publishMetric).toHaveBeenCalledWith(
      "staging",
      MetricName.CognitoConfigDrift,
      1,
    );
  });

  it("does not log the parameter values", async () => {
    vi.mocked(getFunctionEnvironment).mockResolvedValueOnce({
      USERPOOL_ID: "eu-west-2_old-pool",
      CLIENT_ID: "client-old",
    });

    await runCheck();

    const logged = JSON.stringify(vi.mocked(logger.warn).mock.calls);
    expect(logged).not.toContain("eu-west-2_pool");
    expect(logged).not.toContain("client-123");
    expect(logged).not.toContain("client-old");
  });

  it("fails without publishing when the authorizer cannot be read", async () => {
    vi.mocked(getFunctionEnvironment).mockRejectedValueOnce(
      new Error("Unable to read environment"),
    );

    await expect(runCheck()).rejects.toThrow("Unable to read environment");
    expect(publishMetric).not.toHaveBeenCalled();
  });

  it("fails without publishing when a parameter cannot be read", async () => {
    vi.mocked(getParameterValue).mockRejectedValueOnce(
      new Error("ParameterNotFound"),
    );

    await expect(runCheck()).rejects.toThrow("ParameterNotFound");
    expect(publishMetric).not.toHaveBeenCalled();
  });
});
