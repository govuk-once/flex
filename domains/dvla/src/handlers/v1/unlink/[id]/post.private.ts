import { route } from "@domain";
import { status } from "http-status";

import { getDvlaAuthToken } from "../../../../services/authentication";
import { handleStandardErrors } from "../../../../services/errors";

const endpoint = "POST /v1/unlink/:id [private]";

export const handler = route(endpoint, async (ctx) => {
  const auth = await getDvlaAuthToken(ctx);

  const response = await ctx.integrations.dvlaUnlinkUser({
    path: `/${ctx.pathParams.id}`,
    headers: { auth: auth },
    body: {},
  });

  handleStandardErrors(response, endpoint);

  return {
    status: status.OK,
    data: response.data,
  };
});
