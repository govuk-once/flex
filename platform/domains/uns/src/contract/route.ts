import createHttpError from "http-errors";

import {
  NotificationRequestSchema,
  NotificationsPatchRequestSchema,
  NotificationsRequestSchema,
} from "../schemas/domain/notification";
import { normalizeInboundPath } from "../utils/normalizeInboundPath";
import { RouteContract } from "./types";

export const UNS_REMOTE_ROUTES = {
  notification: `/notifications`,
} as const;

export const ROUTE_CONTRACTS = {
  "GET:/v1/notifications": {
    operation: "getNotifications",
    method: "GET",
    inboundPath: "/v1/notifications",
    remotePath: "/v1/notifications",
    toRemote: (event) => {
      const queryParams = event.queryStringParameters || {};
      const rawId = queryParams.externalUserID;
      const validation = NotificationRequestSchema.safeParse({ pushId: rawId });

      if (!validation.success) {
        throw new createHttpError.BadRequest(
          "Missing or invalid externalUserID query parameter",
        );
      }

      return { ...validation.data };
    },
    callRemote: (client, data) => client.notifications.get(data.pushId),
  },
  "GET:/v1/notifications/:id": {
    operation: "getNotificationById",
    method: "GET",
    inboundPath: "/v1/notifications",
    remotePath: "/v1/notifications",
    toRemote: (event) => {
      const pathParams = normalizeInboundPath(event.path).split("/");
      const notificationId = pathParams[3];
      if (!notificationId) {
        throw new createHttpError.BadRequest(
          "Missing customer linking id in path",
        );
      }

      const queryParams = event.queryStringParameters || {};
      const rawId = queryParams.externalUserID;
      const validation = NotificationsRequestSchema.safeParse({
        pushId: rawId,
        notificationId,
      });
      if (!validation.success) {
        throw new createHttpError.BadRequest(
          "Missing or invalid externalUserID query parameter",
        );
      }

      return {
        ...validation.data,
      };
    },
    callRemote: (client, data) =>
      client.notification.get(data.pushId, data.notificationId),
  },
  "DELETE:/v1/notifications/:id": {
    operation: "deleteNotificationById",
    method: "DELETE",
    inboundPath: "/v1/notifications",
    remotePath: "/v1/notifications",
    toRemote: (event) => {
      const pathParams = normalizeInboundPath(event.path).split("/");
      const notificationId = pathParams[3];
      if (!notificationId) {
        throw new createHttpError.BadRequest(
          "Missing customer linking id in path",
        );
      }

      const queryParams = event.queryStringParameters || {};
      const rawId = queryParams.externalUserID;
      const validation = NotificationsRequestSchema.safeParse({
        pushId: rawId,
        notificationId,
      });
      if (!validation.success) {
        throw new createHttpError.BadRequest(
          "Missing or invalid externalUserID query parameter",
        );
      }

      return {
        ...validation.data,
      };
    },
    callRemote: (client, data) =>
      client.notification.delete(data.pushId, data.notificationId),
  },
  "PATCH:/v1/notifications/:id/status": {
    operation: "patchNotificationById",
    method: "PATCH",
    inboundPath: "/v1/notifications",
    remotePath: "/v1/notifications",
    toRemote: (event) => {
      const pathParams = normalizeInboundPath(event.path).split("/");
      const notificationId = pathParams[3];

      if (!notificationId) {
        throw new createHttpError.BadRequest("Missing notification id in path");
      }

      if (!event.body) {
        throw new createHttpError.BadRequest("Request body is missing");
      }

      let jsonBody: unknown;
      try {
        jsonBody = JSON.parse(event.body);
      } catch (_error) {
        throw new createHttpError.BadRequest("Invalid JSON format in body");
      }

      const queryParams = event.queryStringParameters || {};
      const validation = NotificationsPatchRequestSchema.safeParse({
        pushId: queryParams.externalUserID,
        notificationId,
        body: jsonBody,
      });

      if (!validation.success) {
        throw new createHttpError.BadRequest(
          "Validation failed: " + validation.error.message,
        );
      }

      return validation.data;
    },
    callRemote: (client, data) =>
      client.notification.patch(data.pushId, data.notificationId, data.body),
  },
} as const satisfies Record<string, RouteContract>;
