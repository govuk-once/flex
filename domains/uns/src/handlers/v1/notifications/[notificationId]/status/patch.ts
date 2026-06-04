import { route } from "@domain";
import type { UserId } from "@flex/utils";
import { throwIntegrationError } from "@services/errors";

export const handler = route(
  "PATCH /v1/notifications/:notificationId/status",
  async ({ auth, body, integrations, logger, pathParams }) => {
    const { notificationId } = pathParams;

    // TODO: Add SDK alias
    const userId = auth.pairwiseId as UserId;

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
