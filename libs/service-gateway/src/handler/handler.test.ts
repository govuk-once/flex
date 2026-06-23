import { logger } from "@flex/logging";
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

import { createDownstreamClient } from "../client";
import type {
  DownstreamResult,
  GatewayClient,
  GatewayConfig,
  GatewayContext,
  GatewayHandlerMap,
} from "../types";
import { clearTmp } from "../utils/cleanup";
import { buildRoutes, lookupRoute } from "../utils/routes";
import { buildHandler } from ".";
import { buildContext } from "./context";
import { buildMiddleware } from "./middleware";

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
vi.mock("@client");
vi.mock("@utils/cleanup");
vi.mock("@utils/routes");
vi.mock("./context");
vi.mock("./middleware");

const mockHandler = (result: DownstreamResult) =>
  vi.fn(() => Promise.resolve(result));

const mockClient: GatewayClient = { config: {}, request: vi.fn() };
const mockContext: GatewayContext = { client: mockClient, logger };
const mockMiddleware = { handler: (fn: unknown) => fn } as ReturnType<
  typeof buildMiddleware
>;
const mockHandlers: GatewayHandlerMap<GatewayConfig> = {
  [routeKey]: mockHandler({ ok: true, status: 200, data: { result: "ok" } }),
};

const invokeHandler = (
  baseHandlers: GatewayHandlerMap<GatewayConfig> = mockHandlers,
  baseEvent = gatewayEvent,
) => buildHandler(gatewayConfig, baseHandlers)(baseEvent, handlerContext);

describe("buildHandler", () => {
  beforeEach(() => {
    vi.mocked(buildMiddleware).mockReturnValue(mockMiddleware);
    vi.mocked(createDownstreamClient).mockResolvedValue(mockClient);
    vi.mocked(buildRoutes).mockReturnValue([]);
    vi.mocked(lookupRoute).mockReturnValue(matchedRoute);
    vi.mocked(buildContext).mockReturnValue(mockContext);
  });

  it("sets the logger service name and level", () => {
    buildHandler(gatewayConfig, mockHandlers);

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

    expect(lookupRoute).toHaveBeenCalledExactlyOnceWith([], "GET", "/v1/path");
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

  it("skips downstream client creation when the inbound path does not match a route", async () => {
    vi.mocked(lookupRoute).mockReturnValue(undefined);

    await invokeHandler();

    expect(createDownstreamClient).not.toHaveBeenCalled();
  });

  it("skips downstream client creation when the matched route has no handler", async () => {
    await invokeHandler({});

    expect(createDownstreamClient).not.toHaveBeenCalled();
  });

  it.for([
    {
      reason: "converts a 5xx to 502 and ignores the downstream body",
      error: { status: 503, message: "downstream error", body: { leak: true } },
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

  it("returns 500 when an unexpected error occurs", async () => {
    vi.mocked(createDownstreamClient).mockRejectedValue(new Error("error"));

    const result = await invokeHandler();

    expect(result).toStrictEqual({
      statusCode: 500,
      body: { message: "Internal server error" },
    });
  });

  it("clears the tmp folder when the handler throws", async () => {
    vi.mocked(createDownstreamClient).mockRejectedValue(new Error("error"));

    await invokeHandler();

    expect(clearTmp).toHaveBeenCalledOnce();
  });
});
