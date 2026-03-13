import type { HttpMethod } from "../types";

export interface RouteKeySegments {
  method: HttpMethod;
  version: string;
  path: string;
  gateway: "public" | "private";
}

export function extractRouteKeySegments(routeKey: string): RouteKeySegments {
  const [method, versionedPath] = routeKey.split(" ");

  if (!method || !versionedPath) {
    throw new Error(
      `Invalid route key. Expected "METHOD /version/path" or "METHOD /version/path [private]", but got "${routeKey}"`,
    );
  }

  const [, version, ...pathParts] =
    stripRouteKeyGatewayIdentifier(versionedPath).split("/");

  if (!version || pathParts.length === 0) {
    throw new Error(
      `Invalid route key. Expected "METHOD /version/path" or "METHOD /version/path [private]", but got "${routeKey}"`,
    );
  }

  return {
    method: method as HttpMethod,
    version,
    path: `/${pathParts.join("/")}`,
    gateway: routeKey.endsWith("[private]") ? "private" : "public",
  };
}

export function stripRouteKeyGatewayIdentifier(route: string) {
  return route.replace(/\s+\[private\]$/, "");
}
