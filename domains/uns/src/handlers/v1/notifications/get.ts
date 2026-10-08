import { route } from "@domain";
import createHttpError from "http-errors";

export const handler = route(
  "GET /v1/notifications",
  async ({ auth, integrations, logger }) => {
    const userId = auth.pairwiseId;

    const pushIdResponse = await integrations.udpGetPushId({
      headers: { "User-Id": userId },
    });

    if (!pushIdResponse.ok) {
      logger.error("Call to get push id failed", pushIdResponse.error.message);
      throw new createHttpError.BadGateway();
    }

    const { pushId } = pushIdResponse.data;

    const response = await integrations.unsGetNotifications({
      query: { externalUserID: pushId },
    });

    if (!response.ok) {
      logger.error("Call to get notifications failed", response.error.message);
      throw new createHttpError.BadGateway();
    }

    const { data: notifications } = response;

    return { status: 200, data: notifications };
  },
);
