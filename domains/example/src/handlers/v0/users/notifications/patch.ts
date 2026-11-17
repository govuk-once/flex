import createHttpError from "http-errors";

import { route } from "../../../../../domain.config";

export const handler = route(
  "PATCH /v0/users/notifications",
  async ({ auth, body, integrations, logger, featureFlags }) => {
    const { userId } = auth;

    const pushIdResponse = await integrations.udpGetPushId({
      headers: { "User-Id": userId },
    });

    if (!pushIdResponse.ok) {
      logger.debug("Call to get push id failed", pushIdResponse.error.message);
      throw new createHttpError.BadGateway();
    }

    const result = await integrations.udpCreateNotifications({
      body: { ...body, pushId: pushIdResponse.data.pushId },
      headers: {
        "requesting-service": "app",
        "requesting-service-user-id": userId,
      },
    });

    if (!result.ok) {
      const { status, body } = result.error;

      if (status === 409) {
        logger.error("Update rejected because a newer version already exists", {
          status,
          userId,
        });

        throw new createHttpError.Conflict();
      }

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
