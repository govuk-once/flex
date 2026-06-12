import {
  HttpMethodSchema,
  matchPath,
  splitRouteKey,
  toPathSegments,
} from "@flex/utils";

import type { GatewayRoute, GatewayRoutes, RouteKey } from "../types";

interface ParsedRoute {
  config: GatewayRoute;
  key: RouteKey;
  method: string;
  segments: string[];
}

export function buildRoutes(routes: GatewayRoutes): ParsedRoute[] {
  return Object.entries(routes).map(([key, config]) => {
    const { method, path } = parseRouteKey(key);

    return {
      config,
      key: key as RouteKey,
      method,
      segments: toPathSegments(path),
    };
  });
}

// export interface MatchedRoute {
//   config: GatewayRoute;
//   key: RouteKey;
//   params: Record<string, string>;
// }

// export function lookupRoute(
//   routes: readonly ParsedRoute[],
//   method: string,
//   path: string,
// ): MatchedRoute | undefined {
//   for (const route of routes) {
//     if (route.method !== method) continue;

//     const params = matchPath(route.segments, toPathSegments(path));

//     if (params) {
//       return {
//         config: route.config,
//         key: route.key,
//         params,
//       };
//     }
//   }
// }

// interface RouteKeyParts {
//   method: HttpMethod;
//   path: string;
// }

// function parseRouteKey(key: string): RouteKeyParts {
//   const pathParts = splitRouteKey(key);

//   if (pathParts === null) {
//     throw new Error(
//       `Invalid route key. Expected "METHOD /version/path", but got: "${key}"`,
//     );
//   }

//   const [method, path] = pathParts;

//   return { method: method as HttpMethod, path };
// }
