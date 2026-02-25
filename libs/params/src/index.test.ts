import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";
import z from "zod";

vi.mock("@aws-lambda-powertools/parameters/ssm");

const rawConfigSchema = z.looseObject({
  AWS_REGION: z.string().min(1),
  USERPOOL_ID_PARAM_NAME: z.string().min(1),
  CLIENT_ID_PARAM_NAME: z.string().min(1),
});

async function setup() {
  vi.resetModules();
  const config = await import(".");
  const { createLogger } = await import("@flex/logging");
  createLogger({ serviceName: "config_test" });
  return config;
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
        const { getConfig } = await setup();

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
      const { getConfig } = await setup();

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
      const { getConfig } = await setup();

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
      const { getConfig } = await setup();

      env.set({
        AWS_REGION: "us-east-1",
        USERPOOL_ID_PARAM_NAME: "userpool_id_param",
        CLIENT_ID_PARAM_NAME: "client_id_param",
      });

      vi.mocked(getParametersByName).mockResolvedValue(resolvedParamValues);

      const firstConfig = await getConfig(rawConfigSchema);
      const secondConfig = await getConfig(rawConfigSchema);

      expect(vi.mocked(getParametersByName).mock.calls.length).toBe(1);
      expect(secondConfig).toBe(firstConfig);
    });
  });
});
