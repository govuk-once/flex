import { route } from "@domain";
import { status } from "http-status";

import {
  getDvlaAuthToken,
  getUserLinkingId,
} from "../../../../../services/authentication";
import { handleStandardErrors } from "../../../../../services/errors";

const endpoint = "POST /v1/share-code/:id/cancel";

export const handler = route("POST /v1/share-code/:id/cancel", async (ctx) => {
  const [userLinkingId, auth] = await Promise.all([
    getUserLinkingId(ctx),
    getDvlaAuthToken(ctx),
  ]);

  const response = await ctx.integrations.dvlaCancelShareCode({
    path: `/${ctx.pathParams.id}/cancel`,
    headers: { auth: auth },
    query: { linkingId: userLinkingId },
    body: {},
  });

  handleStandardErrors(response, endpoint);

  return {
    status: status.OK,
    data: response.data,
  };
});
