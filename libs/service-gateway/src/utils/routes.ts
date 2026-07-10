import type { HttpMethod } from "@flex/utils";
import { matchPathSegments, splitRouteKey, toPathSegments } from "@flex/utils";

import type { GatewayRoute, GatewayRouteMap, RouteKey } from "../types";

const isDynamicRoute = (route: ParsedRoute) =>
  route.segments.some((segment) => segment.startsWith(":"));

interface ParsedRoute {
  config: GatewayRoute;
  key: RouteKey;
  method: string;
  segments: string[];
}

export interface RouteTable {
  readonly static: ReadonlyMap<string, ParsedRoute>;
  readonly dynamic: readonly ParsedRoute[];
}

export function buildRoutes(routes: GatewayRouteMap): RouteTable {
  const staticRoutes = new Map<string, ParsedRoute>();
  const dynamicRoutes: ParsedRoute[] = [];

  for (const [key, config] of Object.entries(routes)) {
    const { method, path } = parseRouteKey(key);

    const route: ParsedRoute = {
      config,
      key: key as RouteKey,
      method,
      segments: toPathSegments(path),
    };

    if (isDynamicRoute(route)) {
      dynamicRoutes.push(route);
    } else {
      staticRoutes.set(route.key, route);
    }
  }

  return {
    static: staticRoutes,
    dynamic: dynamicRoutes,
  };
}

export interface MatchedRoute {
  config: GatewayRoute;
  key: RouteKey;
  params: Record<string, string>;
}

export function lookupRoute(
  routes: RouteTable,
  method: string,
  path: string,
): MatchedRoute | undefined {
  const routeKey = `${method} ${path}`;

  const staticRoute = routes.static.get(routeKey);

  if (staticRoute) {
    return { key: staticRoute.key, config: staticRoute.config, params: {} };
  }

  const segments = toPathSegments(path);

  for (const route of routes.dynamic) {
    if (route.method !== method) continue;

    const params = matchPathSegments(route.segments, segments);

    if (params) {
      return { key: route.key, config: route.config, params };
    }
  }
}

interface RouteKeyParts {
  method: HttpMethod;
  path: string;
}

function parseRouteKey(key: string): RouteKeyParts {
  const pathParts = splitRouteKey(key);

  if (pathParts === null) {
    throw new Error(
      `Invalid route key. Expected "METHOD /version/path", but got: "${key}"`,
    );
  }

  const [method, path] = pathParts;

  return { method: method as HttpMethod, path };
}
