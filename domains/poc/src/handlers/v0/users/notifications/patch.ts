import crypto from "node:crypto";

import type { NotificationId } from "@flex/udp-domain";
import createHttpError from "http-errors";

import {
  route,
  updateUserNotificationsContext,
} from "../../../../../domain.config";

export const handler = route(
  "PATCH /v0/users/notifications",
  async ({ auth, body, integrations, logger }) => {
    const notificationId = getNotificationId();

    const result = await integrations.udpPostNotifications({
      body: { ...body, notificationId },
      headers: { "requesting-service-user-id": auth.pairwiseId },
    });

    if (!result.ok) {
      const { status, body } = result.error;

      logger.error("Failed to update notifications", { status, body });

      throw new createHttpError.BadGateway();
    }

    return {
      status: 200,
      data: result.data,
    };
  },
);

function getNotificationId() {
  const { auth, resources } = updateUserNotificationsContext();

  return crypto
    .createHmac("sha256", resources.udpNotificationSecret)
    .update(auth.pairwiseId)
    .digest("base64url") as NotificationId;
}
