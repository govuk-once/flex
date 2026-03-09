import createHttpError from "http-errors";

import { route } from "../../../../domain.config";

export const handler = route(
  "POST /v1/poc-user [private]",
  async ({ integrations, logger }) => {
    const createUserResult = await integrations.udpWrite({
      path: "/user",
      body: {},
    });

    if (!createUserResult.ok) {
      logger.error("Failed to create user", {
        response: JSON.stringify(createUserResult),
        status: createUserResult.error.status,
        body: createUserResult.error.body,
      });

      throw new createHttpError.BadGateway();
    }

    return {
      status: 204,
    };
  },
);
