import { logger } from "@flex/logging";
import { it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";
import { z } from "zod";

import type {
  HttpMethod,
  LambdaContext,
  LambdaEvent,
  LogLevel,
} from "../types";
import { HeaderValidationError, RequestBodyParseError } from "../utils";
import { buildHandlerContext } from "./build-context";
import { createRouteContext, createRouteHandler } from "./create-route";
import { mergeHeaders } from "./headers";
import { buildDomainIntegrations } from "./integrations";
import { configureMiddleware } from "./middleware";
import {
  getRouteConfig,
  getRouteIntegrations,
  getRouteLogLevel,
  getRouteResources,
} from "./resolve-config";
import { toApiGatewayResponse, validateHandlerResponse } from "./response";
import type { RouteKeySegments } from "./route-key";
import { extractRouteKeySegments } from "./route-key";
import type { RouteStore } from "./store";
import { getRouteStore } from "./store";

vi.mock("@flex/logging");
vi.mock("./build-context", () => ({ buildHandlerContext: vi.fn() }));
vi.mock("./headers", () => ({ mergeHeaders: vi.fn() }));
vi.mock("./integrations", () => ({ buildDomainIntegrations: vi.fn() }));
vi.mock("./middleware", () => ({ configureMiddleware: vi.fn() }));
vi.mock("./resolve-config", () => ({
  getRouteConfig: vi.fn(),
  getRouteLogLevel: vi.fn(),
  getRouteResources: vi.fn(),
  getRouteIntegrations: vi.fn(),
  getRouteFeatureFlags: vi.fn(),
}));
vi.mock("./response", () => ({
  toApiGatewayResponse: vi.fn(),
  validateHandlerResponse: vi.fn(),
}));
vi.mock("./route-key", () => ({ extractRouteKeySegments: vi.fn() }));

const mockRouteStorageRun = vi.hoisted(() => vi.fn());
vi.mock("./store", () => ({
  getRouteStore: vi.fn(),
  routeStorage: { run: mockRouteStorageRun },
}));

const mockHandlerFn = vi.fn();
const mockMiddyHandler = vi.fn((fn: unknown) => fn);

const mockEvent = {} as LambdaEvent;
const mockContext = {} as LambdaContext;
const mockStore = { logger: {} } as RouteStore;

const routeKey = "GET /v1/endpoint";
const routeKeySegments: RouteKeySegments = {
  method: "GET",
  version: "v1",
  path: "/test",
  gateway: "public",
};
const routeConfig = { name: "test-route" };

const config = {
  name: "test-domain",
  common: {
    access: "public",
    logLevel: "WARN",
    headers: undefined,
  },
  resources: {},
  routes: { v1: { "/endpoint": { GET: { public: routeConfig } } } },
} as const;

function registerRoute() {
  return createRouteHandler(config)(routeKey, mockHandlerFn);
}

function invokeRoute() {
  return registerRoute()(mockEvent, mockContext);
}

describe("createRouteContext", () => {
  it("returns a function that retrieves the route store", () => {
    vi.mocked(getRouteStore).mockReturnValue(mockStore);

    expect(createRouteContext(config)()).toBe(mockStore);
  });

  it("throws when called outside a route handler execution context", () => {
    vi.mocked(getRouteStore).mockImplementation(() => {
      throw new Error("Route store is not available");
    });

    expect(() => createRouteContext(config)()).toThrow(
      "Route store is not available",
    );
  });
});

describe("createRouteHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(configureMiddleware).mockReturnValue({
      handler: mockMiddyHandler,
    } as never);
    vi.mocked(extractRouteKeySegments).mockReturnValue(routeKeySegments);
    vi.mocked(getRouteConfig).mockReturnValue(routeConfig);
    vi.mocked(getRouteLogLevel).mockReturnValue("INFO");
    vi.mocked(buildHandlerContext).mockReturnValue(mockStore);
    vi.mocked(toApiGatewayResponse).mockReturnValue({
      statusCode: 200,
      body: '{"key":"value"}',
    });
    vi.mocked(validateHandlerResponse).mockImplementation((result) => ({
      result,
      errors: undefined,
    }));

    mockRouteStorageRun.mockImplementation((_, fn: () => unknown) => fn());
    mockHandlerFn.mockResolvedValue({ status: 200, data: { key: "value" } });
  });

  describe("Route Handler Configuration", () => {
    it("extracts segments from the route key", () => {
      registerRoute();

      expect(extractRouteKeySegments).toHaveBeenCalledExactlyOnceWith(routeKey);
    });

    it("retrieves the route config from the domain config", () => {
      registerRoute();

      expect(getRouteConfig).toHaveBeenCalledExactlyOnceWith(config, {
        gateway: "public",
        method: "GET",
        path: "/test",
        version: "v1",
      });
    });

    it("resolves log level from common and route-level config", () => {
      vi.mocked(getRouteConfig).mockReturnValue({
        ...routeConfig,
        logLevel: "TRACE",
      });

      registerRoute();

      expect(getRouteLogLevel).toHaveBeenCalledExactlyOnceWith("WARN", "TRACE");
    });

    it("retrieves domain resources referenced in route config", () => {
      vi.mocked(getRouteConfig).mockReturnValue({
        ...routeConfig,
        resources: ["testKey"],
      });

      registerRoute();

      expect(getRouteResources).toHaveBeenCalledExactlyOnceWith(
        config.resources,
        ["testKey"],
      );
    });

    it("merges common and route-level headers", () => {
      vi.mocked(getRouteConfig).mockReturnValue({
        ...routeConfig,
        headers: { custom: { name: "x-route" } },
      });

      registerRoute();

      expect(mergeHeaders).toHaveBeenCalledExactlyOnceWith(
        config.common.headers,
        { custom: { name: "x-route" } },
      );
    });

    it("sets the logger service name from the domain config", () => {
      registerRoute();

      expect(logger.setServiceName).toHaveBeenCalledExactlyOnceWith(
        "test-domain-public-v1-test-route",
      );
    });

    it("sets the logger log level from the resolved route config", () => {
      registerRoute();

      expect(logger.setLogLevel).toHaveBeenCalledExactlyOnceWith("INFO");
    });

    it("registers middleware with the resolved route config", () => {
      const resources = {
        testKey: { type: "kms" as const, value: "test-key-value" },
        testParam: { type: "ssm:runtime" as const, value: "/path/to/param" },
        testSecret: { type: "secret" as const, value: "test-secret-value" },
      };

      vi.mocked(getRouteResources).mockReturnValue(resources);
      vi.mocked(getRouteLogLevel).mockReturnValue("DEBUG");

      registerRoute();

      expect(configureMiddleware).toHaveBeenCalledExactlyOnceWith({
        logger,
        logLevel: "DEBUG",
        hasRequestBody: false,
        resources,
      });
    });

    it.for<{ method: HttpMethod; expected: boolean }>([
      { method: "GET", expected: false },
      { method: "POST", expected: true },
      { method: "PUT", expected: true },
      { method: "PATCH", expected: true },
      { method: "DELETE", expected: false },
    ])(
      "sets hasRequestBody to $expected for $method requests",
      ({ method, expected }) => {
        vi.mocked(extractRouteKeySegments).mockReturnValue({
          ...routeKeySegments,
          method,
        });

        registerRoute();

        expect(configureMiddleware).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ hasRequestBody: expected }),
        );
      },
    );

    it("passes core handler to the middy handler instance", () => {
      registerRoute();

      expect(mockMiddyHandler).toHaveBeenCalledExactlyOnceWith(
        expect.any(Function),
      );
    });
  });

  describe("Core Handler", () => {
    it("builds the handler context from the event, context and resolved route config", async () => {
      vi.mocked(mergeHeaders).mockReturnValue({ test: { name: "x-test" } });

      await invokeRoute();

      expect(buildHandlerContext).toHaveBeenCalledExactlyOnceWith(
        mockEvent,
        mockContext,
        expect.objectContaining({
          gateway: "public",
          logger,
          headers: { test: { name: "x-test" } },
        }),
      );
    });

    it("includes body schema in handler context for write methods", async () => {
      const schema = z.object({ key: z.literal("value") });

      vi.mocked(getRouteConfig).mockReturnValue({
        ...routeConfig,
        body: schema,
      });
      vi.mocked(extractRouteKeySegments).mockReturnValue({
        ...routeKeySegments,
        method: "POST",
      });

      await invokeRoute();

      expect(buildHandlerContext).toHaveBeenCalledExactlyOnceWith(
        mockEvent,
        mockContext,
        expect.objectContaining({ bodySchema: schema }),
      );
    });

    it("omits body schema from handler context for read methods", async () => {
      const schema = z.object({ key: z.literal("value") });

      vi.mocked(getRouteConfig).mockReturnValue({
        ...routeConfig,
        body: schema,
      });

      await invokeRoute();

      expect(buildHandlerContext).toHaveBeenCalledExactlyOnceWith(
        mockEvent,
        mockContext,
        expect.objectContaining({ bodySchema: undefined }),
      );
    });

    it("resolves route integrations from cached domain integrations", async () => {
      const integrations = { testIntegration: vi.fn() };

      vi.mocked(buildDomainIntegrations).mockReturnValue(integrations);
      vi.mocked(getRouteConfig).mockReturnValue({
        ...routeConfig,
        integrations: ["testIntegration"],
      });

      await invokeRoute();

      expect(getRouteIntegrations).toHaveBeenCalledExactlyOnceWith(
        integrations,
        ["testIntegration"],
      );
    });

    it("caches domain integrations across subsequent invocations", async () => {
      const handler = registerRoute();

      await handler(mockEvent, mockContext);
      await handler(mockEvent, mockContext);

      expect(buildDomainIntegrations).toHaveBeenCalledOnce();
    });

    it("calls the handler with the context store as the only argument", async () => {
      await invokeRoute();

      expect(mockHandlerFn).toHaveBeenCalledExactlyOnceWith(mockStore);
    });

    it("executes the handler within the route execution context", async () => {
      await invokeRoute();

      expect(mockRouteStorageRun).toHaveBeenCalledExactlyOnceWith(
        mockStore,
        expect.any(Function),
      );
    });

    it("validates the handler response when a response schema is provided", async () => {
      const schema = z.object({ one: z.literal("two") });

      vi.mocked(getRouteConfig).mockReturnValue({
        ...routeConfig,
        response: schema,
      });

      await invokeRoute();

      expect(validateHandlerResponse).toHaveBeenCalledExactlyOnceWith(
        { status: 200, data: { key: "value" } },
        schema,
        { showErrors: false },
      );
    });

    it.for<{ logLevel: LogLevel; showErrors: boolean }>([
      { logLevel: "DEBUG", showErrors: true },
      { logLevel: "TRACE", showErrors: true },
      { logLevel: "INFO", showErrors: false },
      { logLevel: "WARN", showErrors: false },
    ])(
      "sets showErrors to $showErrors when log level is $logLevel",
      async ({ logLevel, showErrors }) => {
        vi.mocked(getRouteLogLevel).mockReturnValue(logLevel);

        await invokeRoute();

        expect(validateHandlerResponse).toHaveBeenCalledExactlyOnceWith(
          { status: 200, data: { key: "value" } },
          undefined,
          { showErrors },
        );
      },
    );

    it("returns the API Gateway response from the validated handler result", async () => {
      vi.mocked(toApiGatewayResponse).mockReturnValue({
        statusCode: 200,
        body: '{"key":"value"}',
      });

      expect(await invokeRoute()).toStrictEqual({
        statusCode: 200,
        body: '{"key":"value"}',
      });
    });

    it("logs validation errors when the handler response fails schema validation", async () => {
      vi.mocked(validateHandlerResponse).mockReturnValue({
        result: { status: 500, error: "Internal server error" },
        errors: [{ message: "Invalid field" }],
      });

      await invokeRoute();

      expect(logger.error).toHaveBeenCalledExactlyOnceWith(
        "Response validation failed",
        { errors: [{ message: "Invalid field" }] },
      );
    });

    it.for<{ condition: "includes" | "omits"; logLevel: LogLevel }>([
      { condition: "omits", logLevel: "INFO" },
      { condition: "includes", logLevel: "DEBUG" },
      { condition: "includes", logLevel: "TRACE" },
      { condition: "omits", logLevel: "WARN" },
      { condition: "omits", logLevel: "ERROR" },
      { condition: "omits", logLevel: "SILENT" },
      { condition: "omits", logLevel: "CRITICAL" },
    ])(
      "$condition handler result in validation error log when log level is $logLevel",
      async ({ logLevel }) => {
        vi.mocked(getRouteLogLevel).mockReturnValue(logLevel);
        vi.mocked(validateHandlerResponse).mockReturnValue({
          result: { status: 500, error: "Internal server error" },
          errors: [{ message: "Invalid field" }],
        });

        mockHandlerFn.mockResolvedValue({
          status: 200,
          data: { key: "value" },
        });

        await invokeRoute();

        const isVerbose = ["DEBUG", "TRACE"].includes(logLevel);

        expect(logger.error).toHaveBeenCalledExactlyOnceWith(
          "Response validation failed",
          {
            errors: [{ message: "Invalid field" }],
            ...(isVerbose && {
              handlerResult: { status: 200, data: { key: "value" } },
            }),
          },
        );
      },
    );
  });

  describe("Error Handling", () => {
    it("returns 400 with missing headers when header validation failed", async () => {
      const error = new HeaderValidationError(["x-required"]);

      mockHandlerFn.mockRejectedValue(error);

      const result = await invokeRoute();

      expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
        "Missing required headers",
        { headers: ["x-required"] },
      );
      expect(result).toStrictEqual({
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error.message,
          headers: ["x-required"],
        }),
      });
    });

    it("returns 400 with error message when body validation failed", async () => {
      const error = new RequestBodyParseError("Test error message");

      mockHandlerFn.mockRejectedValue(error);

      const result = await invokeRoute();

      expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
        "Invalid request body",
        { message: error.message },
      );
      expect(result).toStrictEqual({
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: error.message }),
      });
    });

    it("re-throws unhandled errors", async () => {
      mockHandlerFn.mockRejectedValue(new Error("Unexpected error"));

      await expect(invokeRoute()).rejects.toThrow("Unexpected error");
    });
  });
});
