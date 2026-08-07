import { route } from "@domain";
import { getDvlaAuthToken, getUserLinkingId } from "@services/authentication";
import { handleDvlaErrorResponse, handleStandardErrors } from "@services/errors";
import { status } from "http-status";

const endpoint = "POST /v1/test-notification";

export const handler = route(endpoint, async (ctx) => {
  const { integrations } = ctx;

  try {
    const [userLinkingId, auth] = await Promise.all([
      getUserLinkingId(ctx),
      getDvlaAuthToken(ctx),
    ]);

    const response = await integrations.dvlaTestNotification({
      body: {},
      headers: { auth },
      path: `/${userLinkingId}`,
    });

    handleStandardErrors(response, endpoint);

    return { status: status.ACCEPTED };
  } catch (error: unknown) {
    return handleDvlaErrorResponse(error);
  }
});
