// Canonical route mapping
export const REMOTE_ROUTES = {
  // identity routes
  "GET:v1/identity/app/:appId": {
    remotePath: "/v1/identity/app",
    method: "GET",
    requiresHeaders: false,
  },
  "POST:v1/user": { remotePath: "/v1/user", method: "POST", requiresHeaders: false },

  // data routes
  "POST:v1/notifications": { remotePath: "/v1/notifications", method: "POST", requiresHeaders: true },
  "GET:v1/notifications": { remotePath: "/v1/notifications", method: "GET", requiresHeaders: true },
  "POST:v1/analytics": { remotePath: "/v1/analytics", method: "POST", requiresHeaders: true },
  "GET:v1/analytics": { remotePath: "/v1/analytics", method: "GET", requiresHeaders: true },
  "POST:v1/preferences": { remotePath: "/v1/preferences", method: "POST", requiresHeaders: true },
  // Unversioned path format (when domain sends .../analytics - proxy = "analytics")
  "GET:notifications": { remotePath: "/v1/notifications", method: "GET", requiresHeaders: true },
  "POST:notifications": { remotePath: "/v1/notifications", method: "POST", requiresHeaders: true },
  "GET:analytics": { remotePath: "/v1/analytics", method: "GET", requiresHeaders: true },
  "POST:analytics": { remotePath: "/v1/analytics", method: "POST", requiresHeaders: true },
  "POST:preferences": { remotePath: "/v1/preferences", method: "POST", requiresHeaders: true },
} as const;

/**
 * Matches a remote path and method to a local path and method
 * @param method - The method to match
 * @param path - The path to match
 * @returns The remote path and method if the path matches, otherwise undefined
 */
export function matchRemoteRoute(
  method: string,
  path: string | undefined,
  stageName: string,
): { remotePath: string; method: string; requiresHeaders: boolean } | undefined {
  if (!path) return undefined;

  const key = `${method}:${path.replace(/^\//, "")}`;
  const config = REMOTE_ROUTES[key as keyof typeof REMOTE_ROUTES];

  if (!config) return undefined;

  const stage = stageName.replace(/^\/|\/$/g, "");
  const pathPart = config.remotePath.replace(/^\//, "");
  const remotePath = stage ? `/${stage}/${pathPart}` : `/${pathPart}`;

  return { remotePath, method: config.method, requiresHeaders: config.requiresHeaders };
}
