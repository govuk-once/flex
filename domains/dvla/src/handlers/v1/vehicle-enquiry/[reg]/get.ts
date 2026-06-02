import { route } from "@domain";
import { handleStandardErrors } from "@services/errors";
import { status } from "http-status";

const endpoint = "GET /v1/vehicle-enquiry/:reg";

export const handler = route(endpoint, async ({ integrations, pathParams }) => {
  const { reg } = pathParams;

  const response = await integrations.dvlaVehicleEnquiry({ path: `/${reg}` });

  handleStandardErrors(response, endpoint);

  return { status: status.OK, data: response.data };
});
