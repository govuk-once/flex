import { route } from "@domain";
import { throwIntegrationError } from "@services/errors";

export const handler = route(
  "PATCH /v1/notifications/:notificationId/status",
  async ({ auth, body, integrations, logger, pathParams }) => {
    const { notificationId } = pathParams;

    const userId = auth.pairwiseId;

    const pushIdResponse = await integrations.udpGetPushId({
      headers: { "User-Id": userId },
    });

    if (!pushIdResponse.ok) {
      const { status, body: errorBody } = pushIdResponse.error;

      logger.error("Call to get push id failed", { status, errorBody });
      throwIntegrationError(status);
    }

    const { pushId } = pushIdResponse.data;

    const response = await integrations.unsPatchNotification({
      query: { externalUserID: pushId },
      path: `/${notificationId}/status`,
      body,
    });

    if (!response.ok) {
      const { status, body: errorBody } = response.error;

      logger.error("Call to patch notification failed", { status, errorBody });
      throwIntegrationError(status);
    }

    return { status: 202 };
  },
);
