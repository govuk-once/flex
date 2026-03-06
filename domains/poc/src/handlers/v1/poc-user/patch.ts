import createHttpError from "http-errors";

import { route } from "../../../../domain.config";

export const handler = route(
  "PATCH /v1/poc-user",
  async ({ auth, body, integrations, logger }) => {
    const patchUserResult = await integrations.udpPatchUser({
      body,
      headers: { "requesting-service-user-id": auth.pairwiseId },
    });

    if (!patchUserResult.ok) {
      logger.error("Failed to update user preferences", {
        response: JSON.stringify(patchUserResult),
        status: patchUserResult.error.status,
        body: patchUserResult.error.body,
      });

      throw new createHttpError.BadGateway();
    }

    return {
      status: 200,
      data: patchUserResult.data,
    };
  },
);
