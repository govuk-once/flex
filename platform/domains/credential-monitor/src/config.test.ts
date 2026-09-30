import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "./config";

const maximumAgeSecrets = [{ secretId: "udp", maxAgeDays: 90 }]; // pragma: allowlist secret
const cognitoParameters = [
  {
    parameterName: "/staging/flex-param/auth/user-pool-id",
    environmentVariable: "USERPOOL_ID",
  },
];

function stubValidEnvironment() {
  vi.stubEnv("AWS_REGION", "eu-west-2");
  vi.stubEnv("FLEX_ENVIRONMENT", "staging");
  vi.stubEnv(
    "AUTHORIZER_FUNCTION_ARN",
    "arn:aws:lambda:eu-west-2:123456789012:function:authorizer",
  );
  vi.stubEnv("MAXIMUM_ROTATION_INTERVAL_DAYS", "90");
  vi.stubEnv("MAXIMUM_AGE_SECRETS", JSON.stringify(maximumAgeSecrets));
  vi.stubEnv("COGNITO_PARAMETERS", JSON.stringify(cognitoParameters));
}

describe("loadConfig", () => {
  beforeEach(() => {
    stubValidEnvironment();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses the environment, including the JSON lists", () => {
    expect(loadConfig()).toEqual({
      AWS_REGION: "eu-west-2",
      FLEX_ENVIRONMENT: "staging",
      AUTHORIZER_FUNCTION_ARN:
        "arn:aws:lambda:eu-west-2:123456789012:function:authorizer",
      MAXIMUM_ROTATION_INTERVAL_DAYS: 90,
      MAXIMUM_AGE_SECRETS: maximumAgeSecrets,
      COGNITO_PARAMETERS: cognitoParameters,
    });
  });

  it.each([
    "AWS_REGION",
    "FLEX_ENVIRONMENT",
    "AUTHORIZER_FUNCTION_ARN",
    "MAXIMUM_ROTATION_INTERVAL_DAYS",
    "MAXIMUM_AGE_SECRETS",
    "COGNITO_PARAMETERS",
  ])("rejects a missing %s", (name) => {
    vi.stubEnv(name, undefined);

    expect(() => loadConfig()).toThrow();
  });

  it.each(["0", "-5", "1.5", "ninety"])(
    "rejects a maximum rotation interval of %s",
    (value) => {
      vi.stubEnv("MAXIMUM_ROTATION_INTERVAL_DAYS", value);

      expect(() => loadConfig()).toThrow();
    },
  );

  it("rejects a maximum-age list that is not JSON", () => {
    vi.stubEnv("MAXIMUM_AGE_SECRETS", "not json");

    expect(() => loadConfig()).toThrow();
  });

  it("rejects a maximum-age entry without a positive whole number of days", () => {
    vi.stubEnv(
      "MAXIMUM_AGE_SECRETS",
      JSON.stringify([{ secretId: "udp", maxAgeDays: 0 }]), // pragma: allowlist secret
    );

    expect(() => loadConfig()).toThrow();
  });

  it("rejects a Cognito parameter without an environment variable", () => {
    vi.stubEnv(
      "COGNITO_PARAMETERS",
      JSON.stringify([{ parameterName: "/staging/flex-param/auth/client-id" }]),
    );

    expect(() => loadConfig()).toThrow();
  });

  it("accepts empty lists", () => {
    vi.stubEnv("MAXIMUM_AGE_SECRETS", "[]");
    vi.stubEnv("COGNITO_PARAMETERS", "[]");

    expect(loadConfig()).toMatchObject({
      MAXIMUM_AGE_SECRETS: [],
      COGNITO_PARAMETERS: [],
    });
  });
});
