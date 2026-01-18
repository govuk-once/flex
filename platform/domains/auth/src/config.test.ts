import { getLogger } from "@flex/logging";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "./config";
import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";

vi.mock("@aws-lambda-powertools/parameters/ssm");

getLogger({serviceName: "config_test"});

describe("Config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getConfig", () => {
    describe("raw environment variable validation", () => {
      it("throws an error if a required environment variable is missing", async () => {
        process.env.AWS_REGION = "us-east-1";
        process.env.USERPOOL_ID_PARAM_NAME = "userpool_id_param";
        delete process.env.CLIENT_ID_PARAM_NAME; // Intentionally left blank to simulate missing variable;
        process.env.REDIS_ENDPOINT_PARAM_NAME = "redis_endpoint_param";

        await expect(getConfig()).rejects.toThrow(/Invalid raw configuration:/);
      });
    });
  });

  describe("parameter fetching and parsed configuration validation", () => {
    const resolvedParamValues = {
      "userpool_id_param": "us-east-1_123456789",
      "client_id_param": "example-client-id-123",
      "redis_endpoint_param": "example.redis.cache.amazonaws.com:6379",
    };

    beforeEach(() => {
      process.env.AWS_REGION = "us-east-1";
      process.env.USERPOOL_ID_PARAM_NAME = "userpool_id_param";
      process.env.CLIENT_ID_PARAM_NAME = "client_id_param";
      process.env.REDIS_ENDPOINT_PARAM_NAME = "redis_endpoint_param";

      vi.resetAllMocks();
    });

    it("returns the parsed configuration when all environment variables and parameters are valid", async () => {
      vi.mocked(getParametersByName).mockResolvedValueOnce(resolvedParamValues);

      const config = await getConfig();

      expect(config).toEqual(expect.objectContaining({
        AWS_REGION: "us-east-1",
        USERPOOL_ID: "us-east-1_123456789",
        CLIENT_ID: "example-client-id-123",
        REDIS_ENDPOINT: "example.redis.cache.amazonaws.com:6379",
      }));
    });

    it("throws an error if a fetched parameter is missing", async () => {
      vi.resetModules();
      const config = await import("./config");
      const logging = await import("@flex/logging");


      vi.mocked(getParametersByName).mockResolvedValueOnce({
        "userpool_id_param": "us-east-1_123456789",
        // "client_id_param" is intentionally missing to simulate the error
        "redis_endpoint_param": "example.redis.cache.amazonaws.com:6379",
      });

      logging.getLogger({serviceName: "config_test"});
      await expect(config.getConfig()).rejects.toThrow("Parameter client_id_param not found or is not a string");
    });
  });

  describe("caching behavior", () => {
    const resolvedParamValues = {
      "userpool_id_param": "us-east-1_123456789",
      "client_id_param": "example-client-id-123",
      "redis_endpoint_param": "example.redis.cache.amazonaws.com:6379",
    };

    beforeEach(() => {
      process.env.AWS_REGION = "us-east-1";
      process.env.USERPOOL_ID_PARAM_NAME = "userpool_id_param";
      process.env.CLIENT_ID_PARAM_NAME = "client_id_param";
      process.env.REDIS_ENDPOINT_PARAM_NAME = "redis_endpoint_param";

      vi.resetAllMocks();
    });

    it("caches the configuration after the first fetch", async () => {
      vi.mocked(getParametersByName).mockResolvedValue(resolvedParamValues);

      vi.resetModules();
      const config = await import("./config");
      const logging = await import("@flex/logging");

      logging.getLogger({serviceName: "config_test"});

      const firstConfig = await config.getConfig();
      const secondConfig = await config.getConfig();

      expect(vi.mocked(getParametersByName).mock.calls.length).toBe(1);
      expect(secondConfig).toBe(firstConfig);
    });
  });
});
