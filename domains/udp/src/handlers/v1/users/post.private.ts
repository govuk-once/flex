import { route } from "@domain";
import createHttpError from "http-errors";

export const handler = route(
  "POST /v1/users [private]",
  async ({ body, integrations, logger }) => {
    const result = await integrations.udpCreateUser({ body });

    if (!result.ok) {
      logger.error("Failed to create user", { status: result.error.status });
      throw new createHttpError.BadGateway();
    }

    return { status: 204 };
  },
);
