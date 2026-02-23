import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { getLogger } from "@flex/logging";
import { it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";
import z from "zod";

vi.mock("@aws-lambda-powertools/parameters/ssm");
vi.mock("@aws-lambda-powertools/parameters/secrets");

export const rawConfigSchema = z.object({
  AWS_REGION: z.string().min(1),
  USERPOOL_ID_PARAM_NAME: z.string().min(1),
  CLIENT_ID_PARAM_NAME: z.string().min(1),
  NEW_FEATURE_FEATURE_FLAG: z.string().min(1),
  CLIENT_SECRET_SECRET: z.string().min(1),
});

getLogger({ serviceName: "config_test" });

async function resetConfigModule() {
  vi.resetModules();
  const config = await import(".");
  const logging = await import("@flex/logging");

  logging.getLogger({ serviceName: "config_test" });
  return config;
}

function getCleanConfig(rawConfigSchema: z.ZodType<Record<string, string>>) {
  return resetConfigModule().then((config) =>
    config.getConfig(rawConfigSchema),
  );
}

function getConfig(rawConfigSchema: z.ZodType<Record<string, string>>) {
  return import(".").then((config) => config.getConfig(rawConfigSchema));
}

describe("Config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getConfig", () => {
    describe("raw environment variable validation", () => {
      it("throws an error if a required environment variable is missing", async ({
        env,
      }) => {
        env.set({
          AWS_REGION: "us-east-1",
          USERPOOL_ID_PARAM_NAME: "userpool_id_param",
          // CLIENT_ID_PARAM_NAME is intentionally left blank to simulate missing variable
        });

        await expect(getCleanConfig(rawConfigSchema)).rejects.toThrow(
          /Invalid raw configuration:/,
        );
      });
    });
  });

  describe("parameter fetching and parsed configuration validation", () => {
    const resolvedParamValues = {
      userpool_id_param: "us-east-1_123456789",
      client_id_param: "example-client-id-123",
    };

    const resolvedSecretValues = {
      client_secret_secret: "example-client-secret-abc", // pragma: allowlist secret
    };

    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("returns the parsed configuration when all environment variables and parameters are valid", async ({
      env,
    }) => {
      env.set({
        AWS_REGION: "us-east-1",
        USERPOOL_ID_PARAM_NAME: "userpool_id_param",
        CLIENT_ID_PARAM_NAME: "client_id_param",
        NEW_FEATURE_FEATURE_FLAG: "true",
        CLIENT_SECRET_SECRET: "example-client-secret-abc", // pragma: allowlist secret
      });

      vi.mocked(getParametersByName).mockResolvedValueOnce(resolvedParamValues);
      vi.mocked(getSecret).mockResolvedValueOnce(
        resolvedSecretValues.client_secret_secret,
      );

      const config = await getCleanConfig(rawConfigSchema);

      expect(config).toEqual({
        parameters: {
          USERPOOL_ID: "us-east-1_123456789",
          CLIENT_ID: "example-client-id-123",
        },
        featureFlags: {
          NEW_FEATURE: true,
        },
        secrets: {
          CLIENT_SECRET: "example-client-secret-abc", // pragma: allowlist secret
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        envvars: expect.objectContaining({
          AWS_REGION: "us-east-1",
        }),
      });
    });

    it("throws an error if a fetched parameter is missing", async ({ env }) => {
      env.set({
        AWS_REGION: "us-east-1",
        USERPOOL_ID_PARAM_NAME: "userpool_id_param",
        CLIENT_ID_PARAM_NAME: "client_id_param",
        NEW_FEATURE_FEATURE_FLAG: "true",
        CLIENT_SECRET_SECRET: "example-client-secret-abc", // pragma: allowlist secret
      });

      vi.mocked(getParametersByName).mockResolvedValueOnce({
        userpool_id_param: "us-east-1_123456789",
        // "client_id_param" is intentionally missing to simulate the error
      });

      await expect(getCleanConfig(rawConfigSchema)).rejects.toThrow(
        "Parameter client_id_param not found or is not a string",
      );
    });
  });

  describe("caching behavior", () => {
    const resolvedParamValues = {
      userpool_id_param: "us-east-1_123456789",
      client_id_param: "example-client-id-123",
    };

    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("caches the configuration after the first fetch", async ({ env }) => {
      env.set({
        AWS_REGION: "us-east-1",
        USERPOOL_ID_PARAM_NAME: "userpool_id_param",
        CLIENT_ID_PARAM_NAME: "client_id_param",
        NEW_FEATURE_FEATURE_FLAG: "true",
        CLIENT_SECRET_SECRET: "example-client-secret-abc", // pragma: allowlist secret
      });

      vi.mocked(getParametersByName).mockResolvedValue(resolvedParamValues);

      const firstConfig = await getCleanConfig(rawConfigSchema);
      const secondConfig = await getConfig(rawConfigSchema);

      expect(vi.mocked(getParametersByName).mock.calls.length).toBe(1);
      expect(secondConfig).toBe(firstConfig);
    });
  });

  describe("feature flag handling", () => {
    const featureFlagConfigSchema = z.object({
      AWS_REGION: z.string().min(1),
      USERPOOL_ID_PARAM_NAME: z.string().min(1),
      CLIENT_ID_PARAM_NAME: z.string().min(1),
      NEW_FEATURE_FEATURE_FLAG: z.string().min(1),
    });

    const resolvedParamValues = {
      userpool_id_param: "us-east-1_123456789",
      client_id_param: "example-client-id-123",
    };

    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("parses feature flags into the featureFlags property", async ({
      env,
    }) => {
      env.set({
        AWS_REGION: "us-east-1",
        USERPOOL_ID_PARAM_NAME: "userpool_id_param",
        CLIENT_ID_PARAM_NAME: "client_id_param",
        NEW_FEATURE_FEATURE_FLAG: "true",
        CLIENT_SECRET_SECRET: "example-client-secret-abc", // pragma: allowlist secret
      });

      vi.mocked(getParametersByName).mockResolvedValueOnce(resolvedParamValues);

      const config = await getCleanConfig(featureFlagConfigSchema);

      expect(config).toEqual(
        expect.objectContaining({
          featureFlags: {
            NEW_FEATURE: true,
          },
        }),
      );
    });

    it.for([
      {
        expectedValue: false,
        envValue: "false",
      },
      {
        expectedValue: false,
        envValue: "",
      },
      {
        expectedValue: false,
        envValue: "0",
      },
      {
        expectedValue: false,
        envValue: "null",
      },
      {
        expectedValue: false,
        envValue: "undefined",
      },
      {
        expectedValue: false,
        envValue: null,
      },
      {
        expectedValue: false,
        envValue: undefined,
      },
    ])(
      'treats "$envValue" feature flags values as false',
      async ({ envValue, expectedValue }, { env }) => {
        const overlyPermissiveZodSchema = featureFlagConfigSchema.extend({
          NEW_FEATURE_FEATURE_FLAG: z.string().nullable(),
        });
        env.set({
          AWS_REGION: "us-east-1",
          USERPOOL_ID_PARAM_NAME: "userpool_id_param",
          CLIENT_ID_PARAM_NAME: "client_id_param",
          NEW_FEATURE_FEATURE_FLAG: envValue,
          CLIENT_SECRET_SECRET: "example-client-secret-abc", // pragma: allowlist secret
        });

        vi.mocked(getParametersByName).mockResolvedValueOnce(
          resolvedParamValues,
        );

        const config = await getCleanConfig(
          overlyPermissiveZodSchema as z.ZodType<Record<string, string>>,
        );

        expect(config).toEqual(
          expect.objectContaining({
            featureFlags: {
              NEW_FEATURE: expectedValue,
            },
          }),
        );
      },
    );
  });
});
