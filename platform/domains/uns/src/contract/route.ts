import createHttpError from "http-errors";

import {
  NotificationRequestSchema,
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
    callRemote: (client, data) => client.notification.get(data.pushId),
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
      client.notifications.get(data.pushId, data.notificationId),
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
      client.notifications.delete(data.pushId, data.notificationId),
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
      client.notifications.delete(data.pushId, data.notificationId),
  },
} as const satisfies Record<string, RouteContract>;
