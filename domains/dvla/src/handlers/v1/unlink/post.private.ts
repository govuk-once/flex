import { route } from "@domain";
import { getDvlaAuthToken, getLinkingId } from "@services/authentication";
import { handleStandardErrors } from "@services/errors";
import { status } from "http-status";

const endpoint = "POST /v1/unlink [private]";

export const handler = route(endpoint, async (ctx) => {
  const { headers, integrations, logger } = ctx;

  const linkingId = await getLinkingId(headers.userId, {
    integrations,
    logger,
  });
  const token = await getDvlaAuthToken(ctx);

  const response = await integrations.dvlaUnlinkUser({
    path: `/${linkingId}`,
    headers: { auth: token },
    body: {},
  });

  handleStandardErrors(response, endpoint);

  return { status: status.OK, data: response.data };
});
