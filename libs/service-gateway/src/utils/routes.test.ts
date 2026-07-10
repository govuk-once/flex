import { describe, expect, it } from "vitest";

import type { GatewayRoute } from "../types";
import { buildRoutes, lookupRoute } from "./routes";

const route: GatewayRoute = { name: "example" };

describe("buildRoutes", () => {
  it("parses routes into static and dynamic groups", () => {
    const result = buildRoutes({
      "GET /v1/example": route,
      "GET /v1/example/:id": route,
      "GET /v1/example/path": route,
    });

    expect(result.static.size).toBe(2);
    expect(result.static.get("GET /v1/example")).toStrictEqual({
      config: route,
      key: "GET /v1/example",
      method: "GET",
      segments: ["v1", "example"],
    });
    expect(result.static.get("GET /v1/example/path")).toStrictEqual({
      config: route,
      key: "GET /v1/example/path",
      method: "GET",
      segments: ["v1", "example", "path"],
    });
    expect(result.dynamic).toHaveLength(1);
    expect(result.dynamic[0]).toStrictEqual({
      config: route,
      key: "GET /v1/example/:id",
      method: "GET",
      segments: ["v1", "example", ":id"],
    });
  });

  it("throws when a route key is invalid", () => {
    const invalidRouteKey = "INVALID";

    expect(() => buildRoutes({ [invalidRouteKey as never]: route })).toThrow(
      `Invalid route key. Expected "METHOD /version/path", but got: "${invalidRouteKey}"`,
    );
  });
});

describe("lookupRoute", () => {
  const routes = buildRoutes({
    "GET /v1/example": route,
    "GET /v1/example/:id": route,
    "POST /v1/example": route,
  });

  it("returns the static route when a static and dynamic route conflict", () => {
    const staticRoute: GatewayRoute = { name: "static" };
    const dynamicRoute: GatewayRoute = { name: "dynamic" };

    const routes = buildRoutes({
      "GET /v1/example/:id": dynamicRoute,
      "GET /v1/example/path": staticRoute,
    });

    expect(lookupRoute(routes, "GET", "/v1/example/path")).toStrictEqual({
      config: staticRoute,
      key: "GET /v1/example/path",
      params: {},
    });
  });

  it("returns the matched route", () => {
    expect(lookupRoute(routes, "GET", "/v1/example")).toStrictEqual({
      config: route,
      key: "GET /v1/example",
      params: {},
    });
  });

  it("returns the matched route with path params", () => {
    expect(lookupRoute(routes, "GET", "/v1/example/123")).toStrictEqual({
      config: route,
      key: "GET /v1/example/:id",
      params: { id: "123" },
    });
  });

  it.for([
    {
      method: "DELETE",
      path: "/v1/example",
      reason: "the method does not match any route",
    },
    {
      method: "GET",
      path: "/v1/unknown",
      reason: "the path does not match any route",
    },
  ])("returns undefined when $reason", ({ method, path }) => {
    expect(lookupRoute(routes, method, path)).toBeUndefined();
  });
});
