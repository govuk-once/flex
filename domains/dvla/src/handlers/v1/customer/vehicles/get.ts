import { route } from "@domain";
import { getDvlaAuthToken, getUserLinkingId } from "@services/authentication";
import { handleDvlaErrorResponse, handleStandardErrors } from "@services/errors";
import { status } from "http-status";

const endpoint = "GET /v1/customer/vehicles";

export const handler = route(endpoint, async (ctx) => {
  const { integrations } = ctx;

  try {
    const [userLinkingId, auth] = await Promise.all([
      getUserLinkingId(ctx),
      getDvlaAuthToken(ctx),
    ]);

    const response = await integrations.dvlaGetCustomerVehicles({
      headers: { auth },
      query: { linkingId: userLinkingId },
    });

    handleStandardErrors(response, endpoint);

    return { status: status.OK, data: response.data };
  } catch (error: unknown) {
    return handleDvlaErrorResponse(error);
  }
});
