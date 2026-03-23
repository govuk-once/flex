import { route } from "@domain";
import type { UserId } from "@flex/utils";
import createHttpError from "http-errors";

export const handler = route(
  "GET /v1/identity/:service",
  async ({ auth, integrations, logger, pathParams }) => {
    const { service } = pathParams;

    // TODO: Add to SDK auth or keep alias for this domain only?
    const userId = auth.pairwiseId as UserId;

    const result = await integrations.udpGetIdentity({
      path: `/exchange`,
      headers: {
        "requesting-service": "app",
        "requesting-service-user-id": userId,
        "User-Id": userId,
      },
      query: { requiredService: service },
    });

    if (!result.ok) {
      const { error } = result;

      if (error.status === 404) {
        logger.info(`Service identity is not linked`, { service, userId });

        return {
          status: 200,
          data: { linked: false },
        };
      }

      logger.error(`Service identity does not exist`, {
        service,
        userId,
        error,
      });

      throw new createHttpError.BadGateway();
    }

    logger.info("Service identity link found", { service, userId });

    return {
      status: 200,
      data: { linked: true },
    };
  },
);
