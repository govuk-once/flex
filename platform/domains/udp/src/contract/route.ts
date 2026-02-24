import { getHeader } from "@flex/utils";
import type { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";

import { inboundPreferencesRequestSchema } from "../schemas/inbound/preferences";
import { inboundCreateUserRequestSchema } from "../schemas/inbound/user";
import type { RouteContract } from "./types";

export const UDP_REMOTE_BASE = "/udp/v1";

export const UDP_REMOTE_ROUTES = {
  notifications: "/notifications",
  user: "/user",
} as const;

export const ROUTE_CONTRACTS = {
  "POST:/v1/user": {
    operation: "createUser",
    method: "POST",
    inboundPath: "/v1/user",
    remotePath: UDP_REMOTE_ROUTES.user,
    inboundSchema: inboundCreateUserRequestSchema,
    toRemoteBody: (inbound) => inbound,
    buildContext: () => ({}),
    callRemote: (client, { remoteBody }) => client.createUser(remoteBody),
  },
  "POST:/v1/notifications": {
    operation: "updateNotifications",
    method: "POST",
    inboundPath: "/v1/notifications",
    remotePath: UDP_REMOTE_ROUTES.notifications,
    inboundSchema: inboundPreferencesRequestSchema,
    toRemoteBody: (inbound) => ({
      notifications: {
        consentStatus: inbound.preferences.notifications.consentStatus,
      },
    }),
    buildContext: (event) => ({
      requestingServiceUserId: assertRequiredHeaderAndReturn(
        event,
        "requesting-service-user-id",
      ),
    }),
    callRemote: (client, { remoteBody, requestingServiceUserId }) =>
      client.updatePreferences(remoteBody, requestingServiceUserId),
  },
  "GET:/v1/notifications": {
    operation: "getNotifications",
    method: "GET",
    inboundPath: "/v1/notifications",
    remotePath: UDP_REMOTE_ROUTES.notifications,
    buildContext: (event) => ({
      requestingServiceUserId: assertRequiredHeaderAndReturn(
        event,
        "requesting-service-user-id",
      ),
    }),
    callRemote: (client, { requestingServiceUserId }) =>
      client.getPreferences(requestingServiceUserId),
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

function assertRequiredHeaderAndReturn(
  event: APIGatewayProxyEvent,
  header: string,
): string {
  const value = getHeader(event, header);
  if (!value) {
    throw new createHttpError.BadRequest(`Missing ${header} header`);
  }
  return value;
}
