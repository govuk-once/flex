import { getHeader } from "@flex/utils";
import type { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";
import z from "zod";

import { inboundCreateOrUpdateNotificationsRequestSchema } from "../schemas/domain/notifications";
import { inboundCreateUserRequestSchema } from "../schemas/domain/user";
import type { RouteContract } from "./types";

const INTERNAL_ROUTES = {
  user: "/v1/user",
  notifications: "/v1/notifications",
} as const;

export const UDP_REMOTE_BASE = "/v1";

export const UDP_REMOTE_ROUTES = {
  notifications: `${UDP_REMOTE_BASE}/notifications`,
  user: `${UDP_REMOTE_BASE}/user`,
} as const;

export const ROUTE_CONTRACTS = {
  "POST:/v1/user": {
    operation: "createUser",
    method: "POST",
    inboundPath: INTERNAL_ROUTES.user,
    remotePath: UDP_REMOTE_ROUTES.user,
    toRemote: async (event) =>
      parseAndMapBody(inboundCreateUserRequestSchema, event),
    callRemote: (client, data) => client.user.create(data),
  },
  "POST:/v1/notifications": {
    operation: "updateNotificationPreferences",
    method: "POST",
    inboundPath: INTERNAL_ROUTES.notifications,
    remotePath: UDP_REMOTE_ROUTES.notifications,
    toRemote: async (event) => {
      const data = await parseAndMapBody(
        inboundCreateOrUpdateNotificationsRequestSchema,
        event,
      );
      const requestingServiceUserId = assertRequiredHeaderAndReturn(
        event,
        "requesting-service-user-id",
      );
      return { data, requestingServiceUserId };
    },
    callRemote: (client, data) =>
      client.notifications.update(data, data.requestingServiceUserId),
    toDomain: (remote) => remote.data,
  },
  "GET:/v1/notifications": {
    operation: "getNotificationPreferences",
    method: "GET",
    inboundPath: INTERNAL_ROUTES.notifications,
    remotePath: UDP_REMOTE_ROUTES.notifications,
    toRemote: (event) => {
      const requestingServiceUserId = assertRequiredHeaderAndReturn(
        event,
        "requesting-service-user-id",
      );
      return Promise.resolve({ requestingServiceUserId });
    },
    callRemote: (client, data) =>
      client.notifications.get(data.requestingServiceUserId),
    toDomain: (remote) => remote.data,
  },
} as const satisfies Record<string, RouteContract>;

async function parseAndMapBody<T extends z.ZodType>(
  schema: T,
  event: APIGatewayProxyEvent,
): Promise<z.infer<T>> {
  const body = parseRequestBody(event.body);
  const result = await schema.safeParseAsync(body);
  if (!result.success) {
    throw new createHttpError.BadRequest(result.error.message);
  }
  return result.data;
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

function parseRequestBody(body: string | null): unknown {
  if (!body) {
    throw new createHttpError.BadRequest("Missing request body");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new createHttpError.BadRequest("Invalid JSON body");
  }
}
