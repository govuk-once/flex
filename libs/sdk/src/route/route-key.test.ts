import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import {
  extractRouteKeySegments,
  stripRouteKeyGatewayIdentifier,
} from "./route-key";

describe("extractRouteKeySegments", () => {
  it.for([
    {
      route: "GET /v1/user",
      expected: {
        method: "GET",
        version: "v1",
        path: "/user",
        gateway: "public",
      },
    },
    {
      route: "POST /v1/user [private]",
      expected: {
        method: "POST",
        version: "v1",
        path: "/user",
        gateway: "private",
      },
    },
    {
      route: "PUT /v1/user/settings",
      expected: {
        method: "PUT",
        version: "v1",
        path: "/user/settings",
        gateway: "public",
      },
    },
    {
      route: "PATCH /v1/user/:userId",
      expected: {
        method: "PATCH",
        version: "v1",
        path: "/user/:userId",
        gateway: "public",
      },
    },
    {
      route: "DELETE /v1/user/:userId [private]",
      expected: {
        method: "DELETE",
        version: "v1",
        path: "/user/:userId",
        gateway: "private",
      },
    },
  ])("parses $route into segments", ({ route, expected }) => {
    expect(extractRouteKeySegments(route)).toStrictEqual(expected);
  });

  it.for(["", "GET", "GET /", "GET /v1"])(
    'throws on invalid route: "%s"',
    (route) => {
      expect(() => extractRouteKeySegments(route)).toThrow(
        `Invalid route key. Expected "METHOD /version/path" or "METHOD /version/path [private]", but got "${route}"`,
      );
    },
  );
});

describe("stripRouteKeyGatewayIdentifier", () => {
  it("returns public route unchanged", () => {
    expect(stripRouteKeyGatewayIdentifier("GET /v1/user")).toBe("GET /v1/user");
  });

  it("returns private route without [private] suffix", () => {
    expect(stripRouteKeyGatewayIdentifier("GET /v1/user [private]")).toBe(
      "GET /v1/user",
    );
  });
});
