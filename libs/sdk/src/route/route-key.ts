import type { HttpMethod } from "../types";

interface RouteKeySegments {
  method: HttpMethod;
  version: string;
  path: string;
  gateway: "public" | "private";
}

export function extractRouteKeySegments(routeKey: string) {
  const [method, versionedPath] = routeKey.split(" ");

  if (!method || !versionedPath) {
    throw new Error(
      `Invalid route key. Expected "METHOD /version/path" or "METHOD /version/path [private]", but got "${routeKey}"`,
    );
  }

  const [, version, ...pathParts] = versionedPath.split("/");

  return {
    method,
    version,
    path: `/${pathParts.join("/")}`,
    gateway: routeKey.endsWith("[private]") ? "private" : "public",
  } as RouteKeySegments;
}

export function stripRouteKeyGatewayIdentifier(route: string) {
  return route.replace(/\s+\[private\]$/, "");
}
