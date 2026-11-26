import { route } from "@domain";
import { getCorrelationId } from "@flex/sdk";
import createHttpError from "http-errors";

export const handler = route(
  "GET /v0/correlation",
  async ({ integrations, logger }) => {
    const result = await integrations.getForwardedCorrelationId({});

    if (!result.ok) {
      logger.error("Failed to call private correlation route", {
        error: result.error,
      });
      throw new createHttpError.BadGateway();
    }

    return {
      status: 200,
      data: {
        correlationId: getCorrelationId() ?? null,
        forwardedCorrelationId: result.data.correlationId,
      },
    };
  },
);
