import { logger } from "@flex/logging";
import { describe, expect, it, vi } from "vitest";

import type { GatewayClientMap, RestClient } from "../types";
import type { ParsedRequest } from "../utils/request";
import { buildContext } from "./context";

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
const options = { clients: mockClients, resources: mockResources, logger };

describe("buildContext", () => {
  it("returns the clients, resources and logger when the request is empty", () => {
    expect(buildContext({}, options)).toStrictEqual({
      clients: mockClients,
      resources: mockResources,
      logger,
    });
  });

  it("merges all parsed request fields into the context", () => {
    const request: ParsedRequest = {
      pathParams: { id: "123" },
      queryParams: { a: "a" },
      headers: { b: "b" },
      body: { c: "c" },
    };

    expect(buildContext(request, options)).toStrictEqual({
      clients: mockClients,
      resources: mockResources,
      logger,
      ...request,
    });
  });

  it("omits all properties missing from the request", () => {
    const result = buildContext({ queryParams: { a: "a" } }, options);

    expect(result).not.toHaveProperty("pathParams");
    expect(result).not.toHaveProperty("headers");
    expect(result).not.toHaveProperty("body");
  });
});
