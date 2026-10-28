import crypto from "node:crypto";

import { routeContext } from "@domain";
import type { PushId } from "@flex/udp-domain";
import type { UserId } from "@flex/utils";
import { createPushId } from "@utils/parser";
import createHttpError from "http-errors";

const context = routeContext<"PATCH /v0/notifications">;

export async function updateNotifications(userId: UserId) {
  return sendToUpstream(userId, generatePushId(userId));
}

function generatePushId(userId: UserId): PushId {
  const { resources } = context();

  return createPushId(
    crypto
      .createHmac("sha256", resources.udpNotificationSecret)
      .update(userId)
      .digest("base64url"),
  );
}

async function sendToUpstream(userId: UserId, pushId: PushId) {
  const { body, integrations, logger } = context();

  const result = await integrations.udpCreateNotifications({
    headers: {
      "requesting-service": "app",
      "requesting-service-user-id": userId,
    },
    body: { consentStatus: body.consentStatus, pushId },
  });

  if (!result.ok) {
    logger.error("Failed to update notifications", {
      userId,
      pushId,
      error: result.error,
    });
    throw new createHttpError.BadGateway();
  }

  logger.debug("Notifications updated");

  return result.data;
}
