import type { UserId } from "@flex/utils";
import createHttpError from "http-errors";

import { route } from "../../../../../domain.config";

export const handler = route("GET /v0/users/notifications", async (ctx) => {
  const userId = ctx.auth.pairwiseId as UserId;

  const pushIdResponse = await ctx.integrations.udpGetPushId({
    headers: { "User-Id": userId },
  });

  if (!pushIdResponse.ok) {
    ctx.logger.debug(
      "Call to get push id failed",
      pushIdResponse.error.message,
    );
    throw new createHttpError.BadGateway();
  }

  const response = await ctx.integrations.unsGetNotifications({
    query: { externalUserID: pushIdResponse.data.pushId },
  });

  if (!response.ok) {
    ctx.logger.debug(
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
