import { route } from "@domain";
import { getDvlaAuthToken } from "@services/authentication";
import { handleStandardErrors } from "@services/errors";
import { status } from "http-status";

const endpoint = "GET /v1/vehicle-enquiry/:reg";

export const handler = route(endpoint, async (ctx) => {
  const { integrations, pathParams } = ctx;
  const { reg } = pathParams;

  const auth = await getDvlaAuthToken(ctx);

  const response = await integrations.dvlaVehicleEnquiry({
    path: `/${reg}`,
    headers: { auth },
  });

  handleStandardErrors(response, endpoint);

  return { status: status.OK, data: response.data };
});
