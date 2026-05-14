import { route } from "@domain";
import { status } from "http-status";

import { handleStandardErrors } from "../../../../services/errors";

const endpoint = "GET /v1/vehicle-enquiry/:reg";

export const handler = route(endpoint, async (ctx) => {
  const response = await ctx.integrations.dvlaVehicleEnquiry({
    path: `/${ctx.pathParams.reg}`,
  });

  handleStandardErrors(response, endpoint);

  return {
    status: status.OK,
    data: response.data,
  };
});
