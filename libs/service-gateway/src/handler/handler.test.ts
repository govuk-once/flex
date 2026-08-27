import { logger } from "@flex/logging";
import { clearTmp } from "@flex/sdk";
import type { PlatformFixture } from "@flex/testing";
import { it } from "@flex/testing";
import {
  HeaderValidationError,
  QueryParametersParseError,
  RequestBodyParseError,
} from "@flex/utils";
import {
  createMatchedRoute,
  createMockClientBuilder,
  stubGatewayRoutes,
  stubGatewayRoutesError,
  testGatewayConfig,
  testGatewayContext,
  testGatewayResources,
  testGatewayRoutes,
  testMatchedRoute,
  testParsedRequest,
  testRoutePath,
  testRouteTable,
} from "@tests/fixtures";
import createHttpError from "http-errors";
import { beforeEach, describe, expect, vi } from "vitest";
import { z } from "zod";

import type {
  GatewayClientMap,
  GatewayConfig,
  GatewayHandlerMap,
} from "../types";
import { parseRequest } from "../utils/request";
import { resolveResources } from "../utils/resources";
import { buildRoutes, lookupRoute } from "../utils/routes";
import { buildHandler } from ".";
import { buildContext } from "./context";
import { buildMiddleware } from "./middleware";

vi.mock("@flex/sdk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@flex/sdk")>()),
  clearTmp: vi.fn(),
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

const testMiddleware = { handler: (fn: unknown) => fn } as ReturnType<
  typeof buildMiddleware
>;

interface InvokeHandlerOptions {
  routes?: GatewayHandlerMap<GatewayConfig, GatewayClientMap>;
  path?: string;
}

function handler(
  platform: PlatformFixture,
  {
    routes = testGatewayRoutes,
    path = testRoutePath,
  }: InvokeHandlerOptions = {},
) {
  return buildHandler(testGatewayConfig, {
    clients: createMockClientBuilder,
    routes,
  })(platform.gatewayEvent.get(path), platform.context());
}

describe("buildHandler", () => {
  beforeEach(() => {
    vi.mocked(buildMiddleware).mockReturnValue(testMiddleware);
    vi.mocked(resolveResources).mockResolvedValue(testGatewayResources);
    vi.mocked(buildRoutes).mockReturnValue(testRouteTable);
    vi.mocked(lookupRoute).mockReturnValue(testMatchedRoute);
    vi.mocked(parseRequest).mockReturnValue(testParsedRequest);
    vi.mocked(buildContext).mockReturnValue(testGatewayContext);
  });

  it("sets the logger service name and level", () => {
    buildHandler(testGatewayConfig, {
      clients: createMockClientBuilder,
      routes: testGatewayRoutes,
    });

    expect(logger.setServiceName).toHaveBeenCalledExactlyOnceWith(
      "example-service-gateway",
    );
    expect(logger.setLogLevel).toHaveBeenCalledExactlyOnceWith("INFO");
  });

  it("returns the handler result for a successful request", async ({
    platform,
  }) => {
    const result = await handler(platform);

    expect(result).toStrictEqual(
      platform.gatewayResult(200, { body: { result: "ok" } }),
    );
    expect(clearTmp).toHaveBeenCalledOnce();
  });

  it("strips the gateway prefix from the inbound path before matching the route", async ({
    platform,
  }) => {
    await handler(platform);

    expect(lookupRoute).toHaveBeenCalledExactlyOnceWith(
      testRouteTable,
      "GET",
      testRoutePath,
    );
  });

  it("returns 404 when the inbound path does not match a route", async ({
    platform,
  }) => {
    vi.mocked(lookupRoute).mockReturnValue(undefined);

    const result = await handler(platform);

    expect(result).toStrictEqual(
      platform.gatewayResult(404, { body: { message: "Route not found" } }),
    );
  });

  it("returns 404 when the matched route does not have a handler", async ({
    platform,
  }) => {
    const result = await handler(platform, { routes: {} });

    expect(result).toStrictEqual(
      platform.gatewayResult(404, {
        body: { message: "Route handler not found" },
      }),
    );
  });

  it("parses the inbound request against the matched route", async ({
    platform,
  }) => {
    await handler(platform);

    expect(parseRequest).toHaveBeenCalledExactlyOnceWith(
      platform.gatewayEvent.get(testRoutePath),
      testMatchedRoute,
    );
  });

  it("resolves the gateway resources with the resource config", async ({
    platform,
  }) => {
    await handler(platform);

    expect(resolveResources).toHaveBeenCalledExactlyOnceWith(
      testGatewayConfig.resources,
    );
  });

  it("builds gateway clients using the resolved resources", async ({
    platform,
  }) => {
    await handler(platform);

    expect(createMockClientBuilder).toHaveBeenCalledExactlyOnceWith(
      testGatewayResources,
    );
  });

  it("passes the parsed request, clients and resources to the handler context", async ({
    platform,
  }) => {
    await handler(platform);

    expect(buildContext).toHaveBeenCalledExactlyOnceWith(testParsedRequest, {
      clients: testGatewayContext.clients,
      resources: testGatewayResources,
      logger,
    });
  });

  it.for([
    {
      reason: "the inbound path does not match a route",
      setup: () => vi.mocked(lookupRoute).mockReturnValue(undefined),
      routes: testGatewayRoutes,
    },
    {
      reason: "the matched route does not have a handler",
      setup: () => {},
      routes: {},
    },
    {
      reason: "the request validation fails",
      setup: () =>
        vi.mocked(parseRequest).mockImplementation(() => {
          throw new RequestBodyParseError("test body error");
        }),
      routes: testGatewayRoutes,
    },
  ])(
    "skips resource resolution and client instantiation when $reason",
    async ({ setup, routes }, { platform }) => {
      setup();

      await handler(platform, { routes });

      expect(resolveResources).not.toHaveBeenCalled();
      expect(createMockClientBuilder).not.toHaveBeenCalled();
    },
  );

  it("returns 502 when the outbound response schema validation fails", async ({
    platform,
  }) => {
    vi.mocked(lookupRoute).mockReturnValue(
      createMatchedRoute({
        config: { response: z.object({ key: z.string() }) },
      }),
    );

    const result = await handler(platform, {
      routes: stubGatewayRoutes({
        ok: true,
        status: 200,
        data: { key: 123 },
      }),
    });

    expect(result).toStrictEqual(
      platform.gatewayResult(502, {
        body: { message: "EXAMPLE upstream response invalid" },
      }),
    );
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      "Gateway response schema validation failed",
      expect.objectContaining({ issues: expect.any(String) as string }),
    );
  });

  it("returns the result unchanged when the outbound response schema validation passes", async ({
    platform,
  }) => {
    vi.mocked(lookupRoute).mockReturnValue(
      createMatchedRoute({
        config: { response: z.object({ key: z.string() }) },
      }),
    );

    const result = await handler(platform, {
      routes: stubGatewayRoutes({
        ok: true,
        status: 200,
        data: { key: "value" },
      }),
    });

    expect(result).toStrictEqual(
      platform.gatewayResult(200, { body: { key: "value" } }),
    );
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
      expected: {
        statusCode: 400,
        body: { message: "downstream error" },
      },
    },
  ])(
    "maps a downstream failure: $reason",
    async ({ error, expected }, { platform }) => {
      const result = await handler(platform, {
        routes: stubGatewayRoutes({ ok: false, error }),
      });

      expect(result).toStrictEqual(
        platform.gatewayResult(expected.statusCode, { body: expected.body }),
      );
    },
  );

  it.for([
    {
      reason: "a required header is missing",
      error: new HeaderValidationError(["key"]),
      expected: { message: "Missing headers: key", headers: ["key"] },
    },
    {
      reason: "the query parameters are invalid",
      error: new QueryParametersParseError({ issues: [] } as never),
      expected: { message: "Invalid query parameters", errors: [] },
    },
    {
      reason: "the request body is invalid",
      error: new RequestBodyParseError("test body error"),
      expected: { message: "test body error" },
    },
  ])("returns 400 when $reason", async ({ error, expected }, { platform }) => {
    const result = await handler(platform, {
      routes: stubGatewayRoutesError(error),
    });

    expect(result).toStrictEqual(
      platform.gatewayResult(400, { body: expected }),
    );
  });

  it("propagates the status code thrown by http-error", async ({
    platform,
  }) => {
    const result = await handler(platform, {
      routes: stubGatewayRoutesError(
        new createHttpError.ImATeapot("test http-error"),
      ),
    });

    expect(result).toStrictEqual(
      platform.gatewayResult(418, { body: { message: "test http-error" } }),
    );
  });

  it("returns 500 when resource resolution fails unexpectedly", async ({
    platform,
  }) => {
    vi.mocked(resolveResources).mockRejectedValue(new Error("error"));

    const result = await handler(platform);

    expect(result).toStrictEqual(
      platform.gatewayResult(500, {
        body: { message: "Internal server error" },
      }),
    );
  });

  it("clears the tmp folder when the handler throws", async ({ platform }) => {
    vi.mocked(resolveResources).mockRejectedValue(new Error("error"));

    await handler(platform);

    expect(clearTmp).toHaveBeenCalledOnce();
  });
});
