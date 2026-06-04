import { route } from "@domain";
import type { UserId } from "@flex/utils";
import { throwIntegrationError } from "@services/errors";
import createHttpError from "http-errors";

export const handler = route(
  "GET /v1/notifications/:notificationId",
  async ({ auth, integrations, logger, pathParams }) => {
    const { notificationId } = pathParams;

    // TODO: Add SDK alias
    const userId = auth.pairwiseId as UserId;

    const pushIdResponse = await integrations.udpGetPushId({
      headers: { "User-Id": userId },
    });

    if (!pushIdResponse.ok) {
      logger.error("Call to get push id failed", pushIdResponse.error.message);
      throw new createHttpError.BadGateway();
    }

    const { pushId } = pushIdResponse.data;

    const response = await integrations.unsGetNotificationById({
      query: { externalUserID: pushId },
      path: `/${notificationId}`,
    });

    if (!response.ok) {
      const { status, body } = response.error;

      logger.error("Call to get notifications failed", {
        status,
        errorBody: body,
      });
      throwIntegrationError(status);
    }

    const { data: notification } = response;

    return { status: 200, data: notification };
  },
);
