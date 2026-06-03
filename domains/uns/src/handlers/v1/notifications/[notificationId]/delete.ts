import { route } from "@domain";
import type { UserId } from "@flex/utils";
import { throwIntegrationError } from "@services/errors";

export const handler = route(
  "DELETE /v1/notifications/:notificationId",
  async ({ auth, integrations, logger, pathParams }) => {
    const { notificationId } = pathParams;

    // TODO: Add SDK alias
    const userId = auth.pairwiseId as UserId;

    const pushIdResponse = await integrations.udpGetPushId({
      headers: { "User-Id": userId },
    });

    if (!pushIdResponse.ok) {
      const { status, body } = pushIdResponse.error;

      logger.error("Call to get push id failed", { status, errorBody: body });
      throwIntegrationError(status);
    }

    const { pushId } = pushIdResponse.data;

    const response = await integrations.unsDeleteNotification({
      query: { externalUserID: pushId },
      path: `/${notificationId}`,
    });

    if (!response.ok) {
      const { status, body } = response.error;

      logger.error("Call to delete notification failed", {
        status,
        errorBody: body,
      });
      throwIntegrationError(status);
    }

    return { status: 204 };
  },
);
