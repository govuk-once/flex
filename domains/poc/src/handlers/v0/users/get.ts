import crypto from "node:crypto";

import type { NotificationId } from "@flex/udp-domain";
import createHttpError from "http-errors";

import { getUsersContext, route } from "../../../../domain.config";

export const handler = route(
  "GET /v0/users",
  async ({ auth, integrations, logger }) => {
    const notificationId = getNotificationId();

    const notificationsResult = await integrations.udpGetNotifications({
      headers: { "requesting-service-user-id": auth.pairwiseId },
    });

    if (notificationsResult.ok) {
      return {
        status: 200,
        data: {
          userId: auth.pairwiseId,
          notificationId,
          preferences: { notifications: notificationsResult.data },
        },
      };
    }

    if (notificationsResult.error.status !== 404) {
      logger.error("Failed to get user notifications", {
        status: notificationsResult.error.status,
        body: notificationsResult.error.body,
      });

      throw new createHttpError.BadGateway();
    }

    logger.debug("User not found, creating user and notifications");

    const createUserResult = await integrations.udpWrite({
      path: "/users",
      body: { notificationId, userId: auth.pairwiseId },
    });

    if (!createUserResult.ok) {
      logger.error("Failed to create user", {
        status: createUserResult.error.status,
        body: createUserResult.error.body,
      });

      throw new createHttpError.BadGateway();
    }

    const createNotificationsResult = await integrations.udpPostNotifications({
      headers: { "requesting-service-user-id": auth.pairwiseId },
      body: { consentStatus: "unknown", notificationId },
    });

    if (!createNotificationsResult.ok) {
      logger.error("Failed to create notifications", {
        status: createNotificationsResult.error.status,
        body: createNotificationsResult.error.body,
      });

      throw new createHttpError.BadGateway();
    }

    return {
      status: 200,
      data: {
        userId: auth.pairwiseId,
        notificationId,
        preferences: { notifications: createNotificationsResult.data },
      },
    };
  },
);

function getNotificationId() {
  const { auth, resources } = getUsersContext();

  return crypto
    .createHmac("sha256", resources.udpNotificationSecret)
    .update(auth.pairwiseId)
    .digest("base64url") as NotificationId;
}
