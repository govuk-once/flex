import createHttpError from "http-errors";

import { route } from "../../../../domain.config";

export const handler = route(
  "POST /v0/users [private]",
  async ({ body, integrations, logger }) => {
    const result = await integrations.udpCreateUser({ body });

    if (!result.ok) {
      logger.error("Failed to create user", {
        status: result.error.status,
        body: result.error.body,
      });

      throw new createHttpError.BadGateway();
    }

    return { status: 204 };
  },
);
