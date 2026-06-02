import { route } from "@domain";
import { getDvlaAuthToken, getUserLinkingId } from "@services/authentication";
import { handleStandardErrors } from "@services/errors";
import { status } from "http-status";

const endpoint = "GET /v1/share-codes";

export const handler = route(endpoint, async (ctx) => {
  const { integrations } = ctx;

  const [userLinkingId, auth] = await Promise.all([
    getUserLinkingId(ctx),
    getDvlaAuthToken(ctx),
  ]);

  const response = await integrations.dvlaGetShareCodes({
    headers: { auth },
    query: { linkingId: userLinkingId },
  });

  handleStandardErrors(response, endpoint);

  const { linkingId: _, ...shareCodes } = response.data;

  return { status: status.OK, data: shareCodes };
});
