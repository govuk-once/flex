import type { UserId } from "@flex/utils";
import createHttpError from "http-errors";

import { route } from "../../../../../domain.config";

export const handler = route(
  "PATCH /v0/users/notifications",
  async ({ auth, body, integrations, logger, featureFlags }) => {
    const userId = auth.pairwiseId as UserId;

    const pushIdResponse = await integrations.udpGetPushId({
      headers: { "User-Id": userId },
    });

    if (!pushIdResponse.ok) {
      logger.debug("Call to get push id failed", pushIdResponse.error.message);
      throw new createHttpError.BadGateway();
    }

    const result = await integrations.udpCreateNotificationPreferences({
      body: { ...body, pushId: pushIdResponse.data.pushId },
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
      data: {
        ...result.data,
        featureFlags: {
          newUserProfileEnabled: featureFlags.newUserProfileEnabled,
        },
      },
    };
  },
);
