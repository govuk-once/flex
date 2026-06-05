import { route } from "@domain";
import { getDvlaAuthToken } from "@services/authentication";
import { handleStandardErrors } from "@services/errors";
import { status } from "http-status";

const endpoint = "POST /v1/unlink/:id [private]";

export const handler = route(endpoint, async (ctx) => {
  const { integrations, pathParams } = ctx;
  const { id } = pathParams;

  const auth = await getDvlaAuthToken(ctx);

  const response = await integrations.dvlaUnlinkUser({
    path: `/${id}`,
    headers: { auth },
    body: {},
  });

  handleStandardErrors(response, endpoint);

  return { status: status.OK, data: response.data };
});
