import { route } from "@domain";
import { throwIntegrationError } from "@services/errors";

export const handler = route(
  "DELETE /v1/notifications/:notificationId",
  async ({ auth, integrations, logger, pathParams }) => {
    const { notificationId } = pathParams;

    const userId = auth.pairwiseId;

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
