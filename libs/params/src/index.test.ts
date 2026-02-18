import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { getLogger } from "@flex/logging";
import { it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";
import z from "zod";

vi.mock("@aws-lambda-powertools/parameters/ssm");

export const rawConfigSchema = z.object({
  AWS_REGION: z.string().min(1),
  USERPOOL_ID_PARAM_NAME: z.string().min(1),
  CLIENT_ID_PARAM_NAME: z.string().min(1),
});

getLogger({ serviceName: "config_test" });

async function resetConfigModule() {
  vi.resetModules();
  const config = await import(".");
  const logging = await import("@flex/logging");

  logging.getLogger({ serviceName: "config_test" });
  return config;
}

function getConfig(rawConfigSchema: z.ZodType<object>, reset: boolean = true) {
  if (reset) {
    return resetConfigModule().then((config) =>
      config.getConfig(rawConfigSchema),
    );
  }
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

        await expect(getConfig(rawConfigSchema)).rejects.toThrow(
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
      });

      vi.mocked(getParametersByName).mockResolvedValueOnce(resolvedParamValues);

      const config = await getConfig(rawConfigSchema);

      expect(config).toEqual(
        expect.objectContaining({
          AWS_REGION: "us-east-1",
          USERPOOL_ID: "us-east-1_123456789",
          CLIENT_ID: "example-client-id-123",
        }),
      );
    });

    it("throws an error if a fetched parameter is missing", async ({ env }) => {
      env.set({
        AWS_REGION: "us-east-1",
        USERPOOL_ID_PARAM_NAME: "userpool_id_param",
        CLIENT_ID_PARAM_NAME: "client_id_param",
      });

      vi.mocked(getParametersByName).mockResolvedValueOnce({
        userpool_id_param: "us-east-1_123456789",
        // "client_id_param" is intentionally missing to simulate the error
      });

      await expect(getConfig(rawConfigSchema)).rejects.toThrow(
        "Parameter client_id_param not found or is not a string",
      );
    });
  });

  describe("caching behavior", () => {
    const resolvedParamValues = {
      userpool_id_param: "us-east-1_123456789",
      client_id_param: "example-client-id-123",
      redis_endpoint_param: "example.redis.cache.amazonaws.com:6379",
    };

    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("caches the configuration after the first fetch", async ({ env }) => {
      env.set({
        AWS_REGION: "us-east-1",
        USERPOOL_ID_PARAM_NAME: "userpool_id_param",
        CLIENT_ID_PARAM_NAME: "client_id_param",
      });

      vi.mocked(getParametersByName).mockResolvedValue(resolvedParamValues);

      const firstConfig = await getConfig(rawConfigSchema);
      const secondConfig = await getConfig(rawConfigSchema, false);

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
        NEW_FEATURE_FEATURE_FLAG: "enabled",
        JIM: "enabled",
      });

      vi.mocked(getParametersByName).mockResolvedValueOnce(resolvedParamValues);

      const config = await getConfig(featureFlagConfigSchema);

      expect(config).toEqual(
        expect.objectContaining({
          AWS_REGION: "us-east-1",
          USERPOOL_ID: "us-east-1_123456789",
          CLIENT_ID: "example-client-id-123",
          featureFlags: {
            NEW_FEATURE: true,
          },
        }),
      );
    });

    it('treats "false" feature flags values as false', async ({ env }) => {
      env.set({
        AWS_REGION: "us-east-1",
        USERPOOL_ID_PARAM_NAME: "userpool_id_param",
        CLIENT_ID_PARAM_NAME: "client_id_param",
        NEW_FEATURE_FEATURE_FLAG: "false",
      });

      vi.mocked(getParametersByName).mockResolvedValueOnce(resolvedParamValues);

      const config = await getConfig(featureFlagConfigSchema);

      expect(config).toEqual(
        expect.objectContaining({
          AWS_REGION: "us-east-1",
          USERPOOL_ID: "us-east-1_123456789",
          CLIENT_ID: "example-client-id-123",
          featureFlags: {
            NEW_FEATURE: false,
          },
        }),
      );
    });
  });
});
