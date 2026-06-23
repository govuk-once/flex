import type { GatewayRoute, GatewayRoutes } from "@types";
import { describe, expect, it } from "vitest";

import { buildRoutes, lookupRoute } from "./routes";

const route: GatewayRoute = { name: "example" };

describe("buildRoutes", () => {
  it("returns a list of parsed routes", () => {
    expect(buildRoutes({ "GET /v1/example": route })).toStrictEqual([
      {
        config: route,
        key: "GET /v1/example",
        method: "GET",
        segments: ["v1", "example"],
      },
    ]);
  });

  it("parses path param segments", () => {
    expect(buildRoutes({ "GET /v1/example/:id": route })).toStrictEqual([
      {
        config: route,
        key: "GET /v1/example/:id",
        method: "GET",
        segments: ["v1", "example", ":id"],
      },
    ]);
  });

  it("parses multiple routes", () => {
    const result = buildRoutes({
      "GET /v1/example": route,
      "POST /v1/example": route,
    });

    const [getRoute, postRoute] = result;

    expect(result).toHaveLength(2);
    expect(getRoute).toMatchObject({
      config: route,
      key: "GET /v1/example",
      method: "GET",
      segments: ["v1", "example"],
    });
    expect(postRoute).toMatchObject({
      config: route,
      key: "POST /v1/example",
      method: "POST",
      segments: ["v1", "example"],
    });
  });

  it("throws when a route key is invalid", () => {
    const invalidRouteKey = "INVALID";

    expect(() =>
      buildRoutes({ [invalidRouteKey]: route } as unknown as GatewayRoutes),
    ).toThrow(
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
