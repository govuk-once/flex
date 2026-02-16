import type { UdpRemoteContract } from "./contracts/remote";

export type UdpRemoteOperation = keyof UdpRemoteContract;

// Canonical route mapping — maps incoming request to remote path + operation
export const REMOTE_ROUTES = {
  "POST:v1/user": {
    remotePath: "/v1/user",
    method: "POST",
    requiresHeaders: false,
    operation: "postUser" as const,
  },

  // data routes
  "POST:v1/notifications": {
    remotePath: "/v1/notifications",
    method: "POST",
    requiresHeaders: true,
    operation: "postNotifications" as const,
  },
  "GET:v1/notifications": {
    remotePath: "/v1/notifications",
    method: "GET",
    requiresHeaders: true,
    operation: "getNotifications" as const,
  },
  // Unversioned path format (when domain sends .../analytics - proxy = "analytics")
  "GET:notifications": {
    remotePath: "/v1/notifications",
    method: "GET",
    requiresHeaders: true,
    operation: "getNotifications" as const,
  },
  "POST:notifications": {
    remotePath: "/v1/notifications",
    method: "POST",
    requiresHeaders: true,
    operation: "postNotifications" as const,
  },
} as const;

export type RouteOperation = UdpRemoteOperation | "proxy";

export type RemoteRouteMapping = {
  operation: RouteOperation;
  remotePath: string;
  method: string;
  requiresHeaders: boolean;
};

/**
 * Matches a remote path and method to a local path and method
 * @param method - The method to match
 * @param path - The path to match
 * @returns The remote path, method, and operation if the path matches, otherwise undefined
 */
export function matchRemoteRoute(
  method: string,
  path: string | undefined,
  stageName: string,
): RemoteRouteMapping | undefined {
  if (!path) return undefined;

  const key = `${method}:${path.replace(/^\//, "")}`;
  if (!(key in REMOTE_ROUTES)) return undefined;

  const config = REMOTE_ROUTES[key as keyof typeof REMOTE_ROUTES];

  const stage = stageName.replace(/^\/|\/$/g, "");
  const pathPart = config.remotePath.replace(/^\//, "");
  const remotePath = stage ? `/${stage}/${pathPart}` : `/${pathPart}`;

  return {
    operation: config.operation,
    remotePath,
    method: config.method,
    requiresHeaders: config.requiresHeaders,
  };
}
