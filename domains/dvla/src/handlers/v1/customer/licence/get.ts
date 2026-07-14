import { route } from "@domain";
import { getDvlaAuthToken, getUserLinkingId } from "@services/authentication";
import { handleStandardErrors } from "@services/errors";
import { status } from "http-status";

const endpoint = "GET /v1/customer/licence";

interface CustomHttpError {
  statusCode: number;
  message: string;
  code?: string;
}

function isCustomHttpError(error: unknown): error is CustomHttpError {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as Record<string, unknown>).statusCode === "number"
  );
}

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
     *    attached
     */
    if (
      isCustomHttpError(error) &&
      error.statusCode === status.NOT_FOUND &&
      error.code
    ) {
      return {
        status: status.NOT_FOUND,
        error: {
          code: error.code,
          message: error.message,
        },
      };
    }

    throw error;
  }
});
