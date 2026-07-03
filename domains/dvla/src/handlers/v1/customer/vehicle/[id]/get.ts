import { route } from "@domain";
import { getDvlaAuthToken, getUserLinkingId } from "@services/authentication";
import { handleStandardErrors } from "@services/errors";
import { status } from "http-status";

const endpoint = "GET /v1/customer/vehicle/:id";

export const handler = route(endpoint, async (ctx) => {
  const { integrations, pathParams } = ctx;
  const { id: vehicleId } = pathParams;

  const [userLinkingId, auth] = await Promise.all([
    getUserLinkingId(ctx),
    getDvlaAuthToken(ctx),
  ]);

  const response = await integrations.dvlaGetCustomerVehicle({
    path: `/${vehicleId}`,
    headers: { auth },
    query: { linkingId: userLinkingId },
  });

  handleStandardErrors(response, endpoint);

  return { status: status.OK, data: response.data };
});
