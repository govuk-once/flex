import { route } from "@domain";
import { getDvsaAuthToken } from "@services/authentication";
import { handleStandardErrors } from "@services/errors";
import { status } from "http-status";

const endpoint = "GET /v1/vehicle/mot/:reg";

export const handler = route(endpoint, async (ctx) => {
  const { integrations, pathParams } = ctx;
  const { reg } = pathParams;

  const auth = await getDvsaAuthToken(ctx);

  const response = await integrations.dvsaVehicleMot({
    path: `/${reg}`,
    headers: { auth },
  });

  handleStandardErrors(response, endpoint);

  return { status: status.OK, data: response.data };
});
