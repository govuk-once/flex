import { route } from "@domain";
import createHttpError from "http-errors";
import { status } from "http-status";

import {
  getDvlaAuthToken,
  getUserLinkingId,
} from "../../../../services/authentication";

export const handler = route("DELETE /v1/share-code/:id", async (ctx) => {
  const [userLinkingId, auth] = await Promise.all([
    getUserLinkingId(ctx),
    getDvlaAuthToken(ctx),
  ]);

  const response = await ctx.integrations.dvlaDeleteShareCode({
    path: ctx.pathParams.id,
    headers: { auth: auth },
    query: { linkingId: userLinkingId },
  });

  if (!response.ok) {
    ctx.logger.error("Failed to create new share codes with DVLA", {
      status: response.error.status,
      errorBody: response.error.body,
    });

    throw new createHttpError.BadGateway();
  }

  return {
    status: status.OK,
    data: response.data,
  };
});
