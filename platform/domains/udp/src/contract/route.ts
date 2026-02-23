import { inboundPreferencesRequestSchema } from "../schemas/inbound/preferences";
import { inboundCreateUserRequestSchema } from "../schemas/inbound/user";
import type { RouteContract } from "./types";

export const UDP_REMOTE_BASE = "/udp/v1";

export const UDP_REMOTE_ROUTES = {
  notifications: "/notifications",
  user: "/user",
} as const;

// Canonical route mapping — maps incoming request to operation + schema.
export const ROUTE_CONTRACTS = {
  "POST:/v1/user": {
    operation: "createUser",
    method: "POST",
    inboundPath: "/v1/user",
    remotePath: UDP_REMOTE_ROUTES.user,
    inboundSchema: inboundCreateUserRequestSchema,
    toRemoteBody: (inbound) => inbound,
  },
  "POST:/v1/notifications": {
    operation: "updateNotifications",
    method: "POST",
    inboundPath: "/v1/notifications",
    remotePath: UDP_REMOTE_ROUTES.notifications,
    requiredHeaders: ["requesting-service-user-id"],
    inboundSchema: inboundPreferencesRequestSchema,
    toRemoteBody: (inbound) => ({
      notifications: {
        consentStatus: inbound.preferences.notifications.consentStatus,
      },
    }),
  },
  "GET:/v1/notifications": {
    operation: "getNotifications",
    method: "GET",
    inboundPath: "/v1/notifications",
    remotePath: UDP_REMOTE_ROUTES.notifications,
    requiredHeaders: ["requesting-service-user-id"],
  },
} as const satisfies Record<string, RouteContract>;

export function matchToRouteContract(
  method: string,
  path: string,
): RouteContract | undefined {
  const key = `${method.toUpperCase()}:${path}`;
  if (key in ROUTE_CONTRACTS) {
    return ROUTE_CONTRACTS[key as keyof typeof ROUTE_CONTRACTS];
  }
  return undefined;
}
