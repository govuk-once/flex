import { route } from "@domain";
import { getDvlaAuthToken, getUserLinkingId } from "@services/authentication";
import { handleStandardErrors } from "@services/errors";
import { status } from "http-status";

const endpoint = "POST /v1/share-code/:id/cancel";

export const handler = route("POST /v1/share-code/:id/cancel", async (ctx) => {
  const { integrations, pathParams } = ctx;
  const { id } = pathParams;

  const [userLinkingId, auth] = await Promise.all([
    getUserLinkingId(ctx),
    getDvlaAuthToken(ctx),
  ]);

  const response = await integrations.dvlaCancelShareCode({
    path: `/${id}/cancel`,
    headers: { auth },
    query: { linkingId: userLinkingId },
    body: {},
  });

  handleStandardErrors(response, endpoint);

  const { data } = response;

  return { status: status.OK, data };
});
