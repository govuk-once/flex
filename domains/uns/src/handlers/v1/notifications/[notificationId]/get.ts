import createHttpError from "http-errors";
import { status } from "http-status";

import { route } from "../../../../../domain.config";

export const handler = route(
  "GET /v1/notifications/:notificationId",
  async (ctx) => {
    const pushIdResponse = await ctx.integrations.udpGetPushId({
      headers: { "User-Id": ctx.auth.pairwiseId },
    });
    if (!pushIdResponse.ok) {
      ctx.logger.error(
        "Call to get push id failed",
        pushIdResponse.error.message,
      );
      throw new createHttpError.BadGateway();
    }

    const { notificationId } = ctx.pathParams;

    const response = await ctx.integrations.unsGetNotificationById({
      query: { externalUserID: pushIdResponse.data.pushId },
      path: `/${notificationId}`,
    });

    if (!response.ok) {
      const { status: errorStatus, body: errorBody } = response.error;
      ctx.logger.error("Call to get notifications failed", {
        status: errorStatus,
        errorBody,
      });
      switch (errorStatus) {
        case status.BAD_REQUEST:
          throw new createHttpError.BadRequest();
        case status.NOT_FOUND:
          throw new createHttpError.NotFound();
        case status.TOO_MANY_REQUESTS:
          throw new createHttpError.TooManyRequests();
        default:
          throw new createHttpError.BadGateway();
      }
    }

    return {
      status: 200,
      data: response.data,
    };
  },
);
