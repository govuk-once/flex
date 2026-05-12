import { route } from "@domain";
import { status } from "http-status";

import { getDvlaAuthToken } from "../../../services/authentication";
import { handleStandardErrors } from "../../../services/errors";

const endpoint = "POST /v1/unlink [private]";

export const handler = route(endpoint, async (ctx) => {
  const auth = await getDvlaAuthToken(ctx);

  const response = await ctx.integrations.dvlaUnlinkUser({
    body: {},
    headers: { auth: auth },
    query: { serviceId: ctx.headers.serviceId },
  });

  handleStandardErrors(response, endpoint);

  return {
    status: status.OK,
    data: response.data,
  };
});
