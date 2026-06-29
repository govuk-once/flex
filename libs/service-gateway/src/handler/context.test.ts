import { logger } from "@flex/logging";
import {
  resolveHeaders,
  resolvePathParams,
  resolveQueryParams,
  resolveRequestBody,
} from "@flex/utils";
import { gatewayEvent, matchedRoute } from "@tests/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GatewayClientMap, RestClient } from "../types";
import { buildContext } from "./context";

vi.mock("@flex/utils", () => ({
  resolvePathParams: vi.fn(),
  resolveQueryParams: vi.fn(),
  resolveHeaders: vi.fn(),
  resolveRequestBody: vi.fn(),
}));

// TODO: test fixtrues
const mockRestClient: RestClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
};
const mockClients: GatewayClientMap = { api: mockRestClient };
const mockResources = { consumerConfig: { apiKey: "test-api-key" } }; // pragma: allowlist secret
const options = {
  clients: mockClients,
  resources: mockResources,
  logger,
  route: matchedRoute,
};

describe("buildContext", () => {
  beforeEach(() => {
    vi.mocked(resolvePathParams).mockReturnValue(undefined);
    vi.mocked(resolveQueryParams).mockReturnValue(undefined);
    vi.mocked(resolveHeaders).mockReturnValue(undefined);
    vi.mocked(resolveRequestBody).mockReturnValue(undefined);
  });

  it("returns the clients, resources and logger when all resolvers return undefined", () => {
    expect(buildContext(gatewayEvent, options)).toStrictEqual({
      clients: mockClients,
      resources: mockResources,
      logger,
    });
  });

  it("includes pathParams when the path parameters resolve to a value", () => {
    vi.mocked(resolvePathParams).mockReturnValue({ id: "123" });

    expect(buildContext(gatewayEvent, options)).toStrictEqual({
      clients: mockClients,
      resources: mockResources,
      logger,
      pathParams: { id: "123" },
    });
  });

  it("includes queryParams when the query parameters resolve to a value", () => {
    vi.mocked(resolveQueryParams).mockReturnValue({ key: "value" });

    expect(buildContext(gatewayEvent, options)).toStrictEqual({
      clients: mockClients,
      resources: mockResources,
      logger,
      queryParams: { key: "value" },
    });
  });

  it("includes headers when the headers resolve to a value", () => {
    vi.mocked(resolveHeaders).mockReturnValue({ auth: "token" });

    expect(buildContext(gatewayEvent, options)).toStrictEqual({
      clients: mockClients,
      resources: mockResources,
      logger,
      headers: { auth: "token" },
    });
  });

  it("includes the body even when it resolves to false", () => {
    vi.mocked(resolveRequestBody).mockReturnValue(false);

    expect(buildContext(gatewayEvent, options)).toStrictEqual({
      clients: mockClients,
      resources: mockResources,
      logger,
      body: false,
    });
  });

  it("omits the body when it resolves as undefined", () => {
    expect(buildContext(gatewayEvent, options)).not.toHaveProperty("body");
  });

  it("returns the whole context when every resolver returns a value", () => {
    vi.mocked(resolvePathParams).mockReturnValue({ id: "123" });
    vi.mocked(resolveQueryParams).mockReturnValue({ a: "a" });
    vi.mocked(resolveHeaders).mockReturnValue({ b: "b" });
    vi.mocked(resolveRequestBody).mockReturnValue({ c: "c" });

    expect(buildContext(gatewayEvent, options)).toStrictEqual({
      clients: mockClients,
      resources: mockResources,
      logger,
      pathParams: { id: "123" },
      queryParams: { a: "a" },
      headers: { b: "b" },
      body: { c: "c" },
    });
  });

  it("passes the correct event and route sources to each resolver", () => {
    buildContext(gatewayEvent, options);

    expect(resolvePathParams).toHaveBeenCalledExactlyOnceWith(
      matchedRoute.params,
    );
    expect(resolveQueryParams).toHaveBeenCalledExactlyOnceWith(
      gatewayEvent.queryStringParameters,
      matchedRoute.config.query,
    );
    expect(resolveHeaders).toHaveBeenCalledExactlyOnceWith(
      gatewayEvent.headers,
      matchedRoute.config.headers,
    );
    expect(resolveRequestBody).toHaveBeenCalledExactlyOnceWith(
      gatewayEvent.body,
      matchedRoute.config.body,
    );
  });
});
