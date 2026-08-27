import { route } from "@domain";
import { getDvlaAuthToken, getUserLinkingId } from "@services/authentication";
import {
  handleDvlaErrorResponse,
  handleStandardErrors,
} from "@services/errors";
import { status } from "http-status";

const endpoint = "GET /v1/customer/licence";

export const handler = route(endpoint, async (ctx) => {
  const { integrations } = ctx;

  try {
    const [userLinkingId, auth] = await Promise.all([
      getUserLinkingId(ctx),
      getDvlaAuthToken(ctx),
    ]);

    const response = await integrations.dvlaGetCustomerLicence({
      headers: { auth },
      query: { linkingId: userLinkingId },
    });

    handleStandardErrors(response, endpoint);

    return { status: status.OK, data: response.data };
  } catch (error: unknown) {
    return handleDvlaErrorResponse(error, {
      "GUK-404-04": "Driving Licence not found",
      "GUK-404-05": "Resource not found",
    });
  }
});
