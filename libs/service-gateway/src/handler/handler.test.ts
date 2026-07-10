import { logger } from "@flex/logging";
import type { ApiResult } from "@flex/sdk";
import { clearTmp } from "@flex/sdk";
import {
  HeaderValidationError,
  QueryParametersParseError,
  RequestBodyParseError,
} from "@flex/utils";
import {
  gatewayConfig,
  gatewayEvent,
  handlerContext,
  matchedRoute,
  routeKey,
} from "@tests/fixtures";
import createHttpError from "http-errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type {
  GatewayClientBuilder,
  GatewayClientMap,
  GatewayConfig,
  GatewayContext,
  GatewayHandlerMap,
  RestClient,
} from "../types";
import { parseRequest } from "../utils/request";
import { resolveResources } from "../utils/resources";
import type { RouteTable } from "../utils/routes";
import { buildRoutes, lookupRoute } from "../utils/routes";
import { buildHandler } from ".";
import { buildContext } from "./context";
import { buildMiddleware } from "./middleware";

vi.mock("@flex/sdk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@flex/sdk")>()),
  clearTmp: vi.fn(),
}));
vi.mock("@flex/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@flex/utils")>()),
  jsonResponse: vi.fn((statusCode: number, body: unknown) => ({
    statusCode,
    body,
  })),
}));
vi.mock("@flex/logging", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setServiceName: vi.fn(),
    setLogLevel: vi.fn(),
  },
}));
vi.mock("../utils/resources", () => ({ resolveResources: vi.fn() }));
vi.mock("../utils/request", () => ({ parseRequest: vi.fn() }));
vi.mock("../utils/routes");
vi.mock("./context");
vi.mock("./middleware");

const mockHandler = (result: ApiResult<unknown>) =>
  vi.fn(() => Promise.resolve(result));

const mockResources = { consumerConfig: { apiKey: "test-api-key" } }; // pragma: allowlist secret
const mockParsedRequest = { queryParams: { key: "value" } };

const mockRestClient: RestClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};

const mockClients: GatewayClientMap = { api: mockRestClient };

const buildMockClients = vi.fn<
  GatewayClientBuilder<GatewayConfig["resources"], GatewayClientMap>
>(() => mockClients);

const mockContext: GatewayContext = {
  clients: mockClients,
  resources: mockResources,
  logger,
};

const mockMiddleware = { handler: (fn: unknown) => fn } as ReturnType<
  typeof buildMiddleware
>;

const mockRouteTable: RouteTable = {
  static: new Map(),
  dynamic: [],
};

const mockRoutes: GatewayHandlerMap<GatewayConfig, GatewayClientMap> = {
  [routeKey]: mockHandler({ ok: true, status: 200, data: { result: "ok" } }),
};

const invokeHandler = (
  routes: GatewayHandlerMap<GatewayConfig, GatewayClientMap> = mockRoutes,
  event = gatewayEvent,
) =>
  buildHandler(gatewayConfig, { clients: buildMockClients, routes })(
    event,
    handlerContext,
  );

describe("buildHandler", () => {
  beforeEach(() => {
    vi.mocked(buildMiddleware).mockReturnValue(mockMiddleware);
    vi.mocked(resolveResources).mockResolvedValue(mockResources);
    vi.mocked(buildRoutes).mockReturnValue(mockRouteTable);
    vi.mocked(lookupRoute).mockReturnValue(matchedRoute);
    vi.mocked(parseRequest).mockReturnValue(mockParsedRequest);
    vi.mocked(buildContext).mockReturnValue(mockContext);
  });

  it("sets the logger service name and level", () => {
    buildHandler(gatewayConfig, {
      clients: buildMockClients,
      routes: mockRoutes,
    });

    expect(logger.setServiceName).toHaveBeenCalledExactlyOnceWith(
      "example-service-gateway",
    );
    expect(logger.setLogLevel).toHaveBeenCalledExactlyOnceWith("INFO");
  });

  it("returns the handler result for a successful request", async () => {
    const result = await invokeHandler();

    expect(result).toStrictEqual({ statusCode: 200, body: { result: "ok" } });
    expect(clearTmp).toHaveBeenCalledOnce();
  });

  it("strips the gateway prefix from the inbound path before matching the route", async () => {
    await invokeHandler();

    expect(lookupRoute).toHaveBeenCalledExactlyOnceWith(
      mockRouteTable,
      "GET",
      "/v1/path",
    );
  });

  it("returns 404 when the inbound path does not match a route", async () => {
    vi.mocked(lookupRoute).mockReturnValue(undefined);

    const result = await invokeHandler();

    expect(result).toStrictEqual({
      statusCode: 404,
      body: { message: "Route not found" },
    });
  });

  it("returns 404 when the matched route does not have a handler", async () => {
    const result = await invokeHandler({});

    expect(result).toStrictEqual({
      statusCode: 404,
      body: { message: "Route handler not found" },
    });
  });

  it("parses the inbound request against the matched route", async () => {
    await invokeHandler();

    expect(parseRequest).toHaveBeenCalledExactlyOnceWith(
      gatewayEvent,
      matchedRoute,
    );
  });

  it("resolves the gateway resources with the resource config", async () => {
    await invokeHandler();

    expect(resolveResources).toHaveBeenCalledExactlyOnceWith(
      gatewayConfig.resources,
    );
  });

  it("builds gateway clients using the resolved resources", async () => {
    await invokeHandler();

    expect(buildMockClients).toHaveBeenCalledExactlyOnceWith(mockResources);
  });

  it("passes the parsed request, clients and resources to the handler context", async () => {
    await invokeHandler();

    expect(buildContext).toHaveBeenCalledExactlyOnceWith(mockParsedRequest, {
      clients: mockClients,
      resources: mockResources,
      logger,
    });
  });

  it.for<{
    reason: string;
    setup: () => GatewayHandlerMap<GatewayConfig, GatewayClientMap>;
  }>([
    {
      reason: "the inbound path does not match a route",
      setup: () => {
        vi.mocked(lookupRoute).mockReturnValue(undefined);
        return mockRoutes;
      },
    },
    { reason: "the matched route does not have a handler", setup: () => ({}) },
    {
      reason: "the request validation fails",
      setup: () => {
        vi.mocked(parseRequest).mockImplementation(() => {
          throw new RequestBodyParseError("test body error");
        });
        return mockRoutes;
      },
    },
  ])(
    "skips resource resolution and client instantiation when $reason",
    async ({ setup }) => {
      await invokeHandler(setup());

      expect(resolveResources).not.toHaveBeenCalled();
      expect(buildMockClients).not.toHaveBeenCalled();
    },
  );

  it("returns 502 when the outbound response schema validation fails", async () => {
    const schema = z.object({ key: z.string() });

    vi.mocked(lookupRoute).mockReturnValue({
      ...matchedRoute,
      config: { ...matchedRoute.config, response: schema },
    });

    const result = await invokeHandler({
      [routeKey]: mockHandler({ ok: true, status: 200, data: { key: 123 } }),
    });

    expect(result).toStrictEqual({
      statusCode: 502,
      body: { message: "EXAMPLE upstream response invalid" },
    });
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      "Gateway response schema validation failed",
      expect.objectContaining({
        issues: expect.stringContaining(
          "Invalid input: expected string",
        ) as string,
      }),
    );
  });

  it("returns the result unchanged when the outbound response schema validation passes", async () => {
    const schema = z.object({ key: z.string() });

    vi.mocked(lookupRoute).mockReturnValue({
      ...matchedRoute,
      config: { ...matchedRoute.config, response: schema },
    });

    const result = await invokeHandler({
      [routeKey]: mockHandler({
        ok: true,
        status: 200,
        data: { key: "value" },
      }),
    });

    expect(result).toStrictEqual({ statusCode: 200, body: { key: "value" } });
  });

  it.for([
    {
      reason: "converts a 5xx to 502 and ignores the downstream body",
      error: {
        status: 503,
        message: "downstream error",
        body: { ignored: true },
      },
      expected: {
        statusCode: 502,
        body: { message: "EXAMPLE upstream service unavailable" },
      },
    },
    {
      reason: "passes through a 4xx with the body when it exists",
      error: {
        status: 404,
        message: "downstream error",
        body: { key: "value" },
      },
      expected: {
        statusCode: 404,
        body: { message: "downstream error", error: { key: "value" } },
      },
    },
    {
      reason: "passes through a 4xx without a body",
      error: { status: 400, message: "downstream error" },
      expected: { statusCode: 400, body: { message: "downstream error" } },
    },
  ])("maps a downstream failure: $reason", async ({ error, expected }) => {
    const result = await invokeHandler({
      [routeKey]: mockHandler({ ok: false, error }),
    });

    expect(result).toStrictEqual(expected);
  });

  it.for([
    {
      reason: "a required header is missing",
      error: new HeaderValidationError(["key"]),
      expected: {
        statusCode: 400,
        body: { headers: ["key"], message: "Missing headers: key" },
      },
    },
    {
      reason: "the query parameters are invalid",
      error: new QueryParametersParseError({ issues: [] } as never),
      expected: {
        statusCode: 400,
        body: { errors: [], message: "Invalid query parameters" },
      },
    },
    {
      reason: "the request body is invalid",
      error: new RequestBodyParseError("test body error"),
      expected: { statusCode: 400, body: { message: "test body error" } },
    },
  ])("returns 400 when $reason", async ({ error, expected }) => {
    const result = await invokeHandler({
      [routeKey]: vi.fn(() => Promise.reject(error)),
    });

    expect(result).toStrictEqual(expected);
  });

  it("propagates the status code thrown by http-error", async () => {
    const httpError = new createHttpError.ImATeapot("test http-error");

    const result = await invokeHandler({
      [routeKey]: vi.fn(() => Promise.reject(httpError)),
    });

    expect(result).toStrictEqual({
      statusCode: 418,
      body: { message: "test http-error" },
    });
  });

  it("returns 500 when resource resolution fails unexpectedly", async () => {
    vi.mocked(resolveResources).mockRejectedValue(new Error("error"));

    const result = await invokeHandler();

    expect(result).toStrictEqual({
      statusCode: 500,
      body: { message: "Internal server error" },
    });
  });

  it("clears the tmp folder when the handler throws", async () => {
    vi.mocked(resolveResources).mockRejectedValue(new Error("error"));

    await invokeHandler();

    expect(clearTmp).toHaveBeenCalledOnce();
  });
});
