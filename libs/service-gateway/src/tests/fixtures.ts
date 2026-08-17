import { logger } from "@flex/logging";
import type { ApiResult } from "@flex/sdk";
import { createFixtureBuilder } from "@flex/testing";
import { vi } from "vitest";

import type {
  GatewayClientBuilder,
  GatewayClientMap,
  GatewayConfig,
  GatewayContext,
  GatewayHandlerMap,
  RestClient,
} from "../types";
import type { ParsedRequest } from "../utils/request";
import type { MatchedRoute, RouteTable } from "../utils/routes";

type GatewayRoutes = GatewayHandlerMap<GatewayConfig, GatewayClientMap>;
type GatewayRouteHandler = GatewayRoutes[keyof GatewayRoutes];

export const testGatewayName = "example";
export const testRouteKey = "GET /v1/path";
export const testRoutePath = "/v1/path";

export const createGatewayConfig = createFixtureBuilder<GatewayConfig>({
  name: testGatewayName,
  environments: [],
  access: "private",
  resources: {},
  policy: {},
  routes: { [testRouteKey]: { name: testGatewayName } },
});
export const testGatewayConfig = createGatewayConfig();

export const createMatchedRoute = createFixtureBuilder<MatchedRoute>({
  key: testRouteKey,
  params: {},
  config: { name: testGatewayName },
});
export const testMatchedRoute = createMatchedRoute();

export const createRouteTable = (
  overrides: Partial<RouteTable> = {},
): RouteTable => ({ static: new Map(), dynamic: [], ...overrides });
export const testRouteTable = createRouteTable();

export const createGatewayRoutes = (
  handler: GatewayRouteHandler,
): GatewayRoutes => ({ [testRouteKey]: handler });

export const createGatewayResources = createFixtureBuilder({
  consumerConfig: { apiKey: "test-api-key" }, // pragma: allowlist secret
});
export const testGatewayResources = createGatewayResources();

export const createMockRestClient = (): RestClient => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

export const createGatewayClients = (): GatewayClientMap => ({
  api: createMockRestClient(),
});

export const createGatewayContext = (
  overrides: Partial<GatewayContext> = {},
): GatewayContext => ({
  logger,
  clients: createGatewayClients(),
  resources: testGatewayResources,
  ...overrides,
});
export const testGatewayContext = createGatewayContext();

export const createMockClientBuilder = vi.fn<
  GatewayClientBuilder<GatewayConfig["resources"], GatewayClientMap>
>(() => testGatewayContext.clients);

export const stubGatewayRoutes = <T>(result: ApiResult<T>) =>
  createGatewayRoutes(vi.fn(() => Promise.resolve(result)));
export const testGatewayRoutes = stubGatewayRoutes({
  ok: true,
  status: 200,
  data: { result: "ok" },
});

export const stubGatewayRoutesError = (error: Error) =>
  createGatewayRoutes(vi.fn(() => Promise.reject(error)));

export const createParsedRequest = createFixtureBuilder<ParsedRequest>({});
export const testParsedRequest = createParsedRequest();
