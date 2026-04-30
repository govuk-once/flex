import createHttpError from "http-errors";

import { route } from "../../../../domain.config";

export const handler = route("GET /v1/notifications", async (ctx) => {
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

  const response = await ctx.integrations.unsGetNotifications({
    query: { externalUserID: pushIdResponse.data.pushId },
  });

  if (!response.ok) {
    ctx.logger.error(
      "Call to get notifications failed",
      response.error.message,
    );
    throw new createHttpError.BadGateway();
  }

  return {
    status: 200,
    data: response.data,
  };
});
