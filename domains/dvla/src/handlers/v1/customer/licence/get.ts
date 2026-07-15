import { route } from "@domain";
import { getDvlaAuthToken, getUserLinkingId } from "@services/authentication";
import { handleStandardErrors } from "@services/errors";
import { isHttpError } from "http-errors";
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
    /**
     * TARGETED ERROR INTERCEPTION
     *  - Only intercept if it's a 404 AND has an explicit provider code
     *    attached. The reason for this is that DVLA may return the following
     *    two error codes: GUK-404-04, GUK-404-05
     *    In which the app team will need to be able show different states on
     *    these 404 errors
     */
    if (
      isHttpError(error) &&
      error.statusCode === status.NOT_FOUND &&
      "code" in error &&
      typeof error.code === "string" &&
      (error.code === "GUK-404-04" || error.code === "GUK-404-05")
    ) {
      return {
        status: status.NOT_FOUND,
        error: {
          code: error.code,
          message: error.message || "Not Found",
        },
      };
    }

    throw error;
  }
});
