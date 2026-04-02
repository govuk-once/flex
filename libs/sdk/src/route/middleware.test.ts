import { injectLambdaContext, logger } from "@flex/logging";
import { it } from "@flex/testing";
import httpErrorHandler from "@middy/http-error-handler";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import secretsManager, { secret } from "@middy/secrets-manager";
import ssm from "@middy/ssm";
import { assert, beforeEach, describe, expect, vi } from "vitest";

import type { MiddlewareOptions } from "./middleware";
import { configureMiddleware } from "./middleware";
import type { ResolvedResource } from "./resolve-config";

vi.mock("@flex/logging");
vi.mock("@middy/http-error-handler");
vi.mock("@middy/http-header-normalizer");
vi.mock("@middy/http-json-body-parser");
vi.mock("@middy/secrets-manager");
vi.mock("@middy/ssm");

const mockMiddyUse = vi.hoisted(() => vi.fn());
const mockMiddy = vi.hoisted(() => {
  const instance = { use: mockMiddyUse };
  mockMiddyUse.mockReturnValue(instance);
  return instance;
});

vi.mock("@middy/core", () => ({ default: vi.fn(() => mockMiddy) }));

const options: MiddlewareOptions = {
  logger,
  logLevel: "INFO",
  hasRequestBody: false,
};

describe("configureMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the configured middy handler instance", () => {
    expect(configureMiddleware(options)).toBe(mockMiddy);
  });

  describe("HTTP Error Handler Middleware", () => {
    it("registers middleware to the handler", () => {
      configureMiddleware(options);

      expect(httpErrorHandler).toHaveBeenCalledOnce();
    });

    it("Forwards errors to a custom logger", () => {
      const middleware = vi.mocked(httpErrorHandler);

      const error = new Error("Uncaught test error");

      configureMiddleware(options);

      assert(middleware.mock.lastCall);

      const [{ logger: middlewareLogger } = {}] = middleware.mock.lastCall;

      assert(typeof middlewareLogger === "function");

      middlewareLogger(error);

      expect(logger.error).toHaveBeenCalledExactlyOnceWith("Unhandled error", {
        detail: {
          name: "Error",
          message: "Uncaught test error",
          stack: expect.any(String) as string,
        },
      });
    });
  });

  describe("Lambda Context Middleware", () => {
    it("registers middleware to the handler", () => {
      vi.mocked(injectLambdaContext).mockReturnValueOnce({});

      configureMiddleware(options);

      expect(mockMiddyUse).toHaveBeenCalledWith({});
      expect(injectLambdaContext).toHaveBeenCalledExactlyOnceWith(logger, {
        correlationIdPath: "requestContext.requestId",
        logEvent: false,
      });
    });

    it.for([
      { state: "disables", logLevel: "INFO", logEvent: false },
      { state: "enables", logLevel: "DEBUG", logEvent: true },
      { state: "enables", logLevel: "TRACE", logEvent: true },
      { state: "disables", logLevel: "WARN", logEvent: false },
      { state: "disables", logLevel: "ERROR", logEvent: false },
      { state: "disables", logLevel: "SILENT", logEvent: false },
      { state: "disables", logLevel: "CRITICAL", logEvent: false },
    ])(
      "$state event logging when log level is $logLevel",
      ({ logEvent, logLevel }) => {
        configureMiddleware({ ...options, logLevel });

        expect(injectLambdaContext).toHaveBeenCalledExactlyOnceWith(
          logger,
          expect.objectContaining({ logEvent }),
        );
      },
    );
  });

  describe("HTTP Header Normaliser Middleware", () => {
    it("registers middleware to the handler", () => {
      configureMiddleware({ ...options, hasRequestBody: true });

      expect(httpHeaderNormalizer).toHaveBeenCalledOnce();
    });

    it("does not register middleware if the event does not include a request body", () => {
      configureMiddleware(options);

      expect(httpHeaderNormalizer).not.toHaveBeenCalled();
    });
  });

  describe("HTTP JSON Body Parser Middleware", () => {
    it("registers middleware to the handler when event includes a request body", () => {
      configureMiddleware({ ...options, hasRequestBody: true });

      expect(httpJsonBodyParser).toHaveBeenCalledOnce();
    });

    it("omits middleware if the event does not include a request body", () => {
      configureMiddleware(options);

      expect(httpJsonBodyParser).not.toHaveBeenCalled();
    });
  });

  describe("Secrets Manager Middleware", () => {
    it("registers middleware to the handler", () => {
      vi.mocked(secret).mockImplementationOnce((v) => `secret:${v}`);

      const resources: Record<string, ResolvedResource> = {
        testSecret: { type: "secret", value: "/path/to/secret" },
      };

      configureMiddleware({ ...options, resources });

      expect(secretsManager).toHaveBeenCalledExactlyOnceWith({
        fetchData: { testSecret: "secret:/path/to/secret" }, // pragma: allowlist secret
        setToContext: true,
      });
      expect(secret).toHaveBeenCalledExactlyOnceWith("/path/to/secret");
    });

    it("omits middleware when no secret resources are provided", () => {
      configureMiddleware(options);

      expect(secretsManager).not.toHaveBeenCalled();
      expect(secret).not.toHaveBeenCalled();
    });

    it("omits middleware when resources is empty", () => {
      configureMiddleware({ ...options, resources: {} });

      expect(secretsManager).not.toHaveBeenCalled();
      expect(secret).not.toHaveBeenCalled();
    });

    it("omits middleware when only non-secret resources exist", () => {
      const resources: Record<string, ResolvedResource> = {
        testKey: { type: "kms", value: "test-key-value" },
        testResolvedParam: { type: "ssm", value: "test-param-value" },
        testParam: { type: "ssm:runtime", value: "/path/to/param" },
      };

      configureMiddleware({ ...options, resources });

      expect(secretsManager).not.toHaveBeenCalled();
      expect(secret).not.toHaveBeenCalled();
    });
  });

  describe("SSM Middleware", () => {
    it("registers middleware to the handler", () => {
      const resources: Record<string, ResolvedResource> = {
        resolvedParam: { type: "ssm", value: "resolved-value" },
        testParam: { type: "ssm:runtime", value: "/path/to/param" },
      };

      configureMiddleware({ ...options, resources });

      expect(ssm).toHaveBeenCalledExactlyOnceWith({
        fetchData: { testParam: "/path/to/param" },
        setToContext: true,
      });
    });

    it("omits middleware when no SSM resources are provided", () => {
      configureMiddleware(options);

      expect(ssm).not.toHaveBeenCalled();
    });

    it("omits middleware when resources is empty", () => {
      configureMiddleware({ ...options, resources: {} });

      expect(ssm).not.toHaveBeenCalled();
    });

    it("omits middleware when only non-ssm (runtime) resources exist", () => {
      const resources: Record<string, ResolvedResource> = {
        testKey: { type: "kms", value: "test-key-value" },
        testResolvedParam: { type: "ssm", value: "test-param-value" },
        testSecret: { type: "secret", value: "/path/to/secret" },
      };

      configureMiddleware({ ...options, resources });

      expect(ssm).not.toHaveBeenCalled();
    });
  });
});
