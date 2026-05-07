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
    path: `/${ctx.pathParams.id}`,
    headers: { auth: auth },
    query: { linkingId: userLinkingId },
  });

  if (!response.ok) {
    ctx.logger.error("Failed to delete share code with DVLA", {
      status: response.error.status,
      errorBody: response.error.body,
    });

    if (response.error.status === status.NOT_FOUND) {
      throw new createHttpError.NotFound();
    }

    throw new createHttpError.BadGateway();
  }

  return {
    status: status.OK,
    data: response.data,
  };
});
