import { route } from "@domain";
import { status } from "http-status";

import {
  getDvlaAuthToken,
  getUserLinkingId,
} from "../../../services/authentication";
import { handleStandardErrors } from "../../../services/errors";
import { removeLinkingId } from "../../../services/removeLinkingId";

const endpoint = "GET /v1/share-codes";

export const handler = route(endpoint, async (ctx) => {
  const [userLinkingId, auth] = await Promise.all([
    getUserLinkingId(ctx),
    getDvlaAuthToken(ctx),
  ]);

  const response = await ctx.integrations.dvlaGetShareCodes({
    headers: { auth: auth },
    query: { linkingId: userLinkingId },
  });

  handleStandardErrors(response, endpoint);

  return {
    status: status.OK,
    data: removeLinkingId(response.data),
  };
});
