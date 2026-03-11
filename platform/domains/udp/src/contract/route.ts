import { getHeader } from "@flex/utils";
import { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";
import z from "zod";

import {
  getIdentityRequestBodySchema,
  identityRequestBodySchema,
} from "../schemas/domain/identity";
import { inboundCreateOrUpdateNotificationsRequestSchema } from "../schemas/domain/notifications";
import { inboundCreateUserRequestSchema } from "../schemas/domain/user";
import { normalizeInboundPath } from "../utils/normalizeInboundPath";
import type { RouteContract } from "./types";

const INTERNAL_ROUTES = {
  user: "/v1/users",
  notifications: "/v1/notifications",
} as const;

export const UDP_REMOTE_BASE = "/v1";

export const UDP_REMOTE_ROUTES = {
  notifications: `${UDP_REMOTE_BASE}/notifications`,
  user: `${UDP_REMOTE_BASE}/user`,
  identity: `${UDP_REMOTE_BASE}/identity`,
} as const;

export const ROUTE_CONTRACTS = {
  "POST:/v1/users": {
    operation: "createUser",
    method: "POST",
    inboundPath: INTERNAL_ROUTES.user,
    remotePath: UDP_REMOTE_ROUTES.user,
    toRemote: async (event) => {
      const data = await parseAndMapBody(inboundCreateUserRequestSchema, event);
      return {
        notificationId: data.notificationId,
        appId: data.userId,
      };
    },
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
  "GET:/v1/identity/:serviceName": {
    operation: "getIdentityLink",
    method: "GET",
    inboundPath: "/v1/identity",
    remotePath: "/v1/identity",
    toRemote: async (event) => {
      const pathParams = normalizeInboundPath(event.path).split("/");
      const serviceName = pathParams[3];

      if (!serviceName) {
        throw new createHttpError.BadRequest(
          "Missing serviceName or identifier in path",
        );
      }

      const { appId } = await parseAndMapBody(
        getIdentityRequestBodySchema,
        event,
      );
      return { serviceName, userId: appId };
    },
    callRemote: (client, data) =>
      client.serviceLink.get(data.serviceName, data.userId),
  },
  "POST:/v1/identity/:serviceName/:identifier": {
    operation: "createIdentityLink",
    method: "POST",
    inboundPath: "/v1/identity",
    remotePath: "/v1/identity",
    toRemote: async (event) => {
      const pathParams = normalizeInboundPath(event.path).split("/");
      const serviceName = pathParams[3];
      const identifier = pathParams[4];

      if (!serviceName || !identifier) {
        throw new createHttpError.BadRequest(
          "Missing serviceName or identifier in path",
        );
      }

      const body = await parseAndMapBody(identityRequestBodySchema, event);
      return { serviceName, identifier, body };
    },
    callRemote: (client, data) =>
      client.serviceLink.create(data.serviceName, data.identifier, data.body),
  },
} as const satisfies Record<string, RouteContract>;

async function parseAndMapBody<T extends z.ZodType>(
  schema: T,
  event: APIGatewayProxyEvent,
): Promise<z.infer<T>> {
  const body = parseRequestBody(event.body);
  const result = await schema.safeParseAsync(body);
  if (!result.success) {
    throw new createHttpError.BadRequest();
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
