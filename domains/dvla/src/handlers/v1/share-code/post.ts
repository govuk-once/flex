import { route } from "@domain";
import { getDvlaAuthToken, getUserLinkingId } from "@services/authentication";
import { handleStandardErrors } from "@services/errors";
import { status } from "http-status";

const endpoint = "POST /v1/share-code";

export const handler = route(endpoint, async (ctx) => {
  const { integrations } = ctx;

  const [userLinkingId, auth] = await Promise.all([
    getUserLinkingId(ctx),
    getDvlaAuthToken(ctx),
  ]);

  const response = await integrations.dvlaPostShareCode({
    body: {},
    headers: { auth },
    query: { linkingId: userLinkingId },
  });

  handleStandardErrors(response, endpoint);

  const { data } = response;

  return { status: status.OK, data };
});
