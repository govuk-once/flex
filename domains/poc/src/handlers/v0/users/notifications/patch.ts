import crypto from "node:crypto";

import type { NotificationId } from "@flex/udp-domain";
import type { UserId } from "@flex/utils";
import createHttpError from "http-errors";

import { route, routeContext } from "../../../../../domain.config";

const context = routeContext<"PATCH /v0/users/notifications">;

export const handler = route(
  "PATCH /v0/users/notifications",
  async ({ auth, body, integrations, logger, featureFlags }) => {
    const userId = auth.pairwiseId as UserId;

    const notificationId = getNotificationId();

    const result = await integrations.udpCreateNotificationPreferences({
      body: { ...body, notificationId },
      headers: {
        "requesting-service": "app",
        "requesting-service-user-id": userId,
      },
    });

    if (!result.ok) {
      const { status, body } = result.error;

      logger.error("Failed to update notifications", { status, body });

      throw new createHttpError.BadGateway();
    }

    return {
      status: 200,
      data: result.data,
      featureFlags: {
        newUserProfileEnabled: featureFlags.newUserProfileEnabled,
      },
    };
  },
);

function getNotificationId() {
  const { auth, resources } = context();

  return crypto
    .createHmac("sha256", resources.udpNotificationSecret)
    .update(auth.pairwiseId)
    .digest("base64url") as NotificationId;
}
