import type { CreateUserRequest, CreateUserResponse } from "@flex/udp-domain";
import createHttpError from "http-errors";

import { route } from "../../../../domain.config";

export const handler = route(
  "POST /v1/poc-user [private]",
  async ({ body, integrations, logger }) => {
    const createUserResult = await integrations.udpWrite<
      CreateUserRequest,
      CreateUserResponse
    >({
      path: "/user",
      body,
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
