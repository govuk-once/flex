import { ApiGatewayEnvelope } from "@aws-lambda-powertools/parser/envelopes/api-gateway";
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { jsonResponse } from "@flex/utils";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import createHttpError from "http-errors";
import status from "http-status";
import { z } from "zod";

export const handlerRequestSchema = z.object({
  preferences: z.object({
    notifications: z.object({
      consentStatus: z.enum(["accepted", "denied", "unknown"]),
    }),
  }),
});

export const handler = createLambdaHandler(
  async (event) => {
    const logger = getLogger();
    const parsedEvent = ApiGatewayEnvelope.safeParse(
      event,
      handlerRequestSchema,
    );

    if (!parsedEvent.success) {
      const message = `Invalid parsed event: ${parsedEvent.error.message}`;
      logger.debug(message);
      throw new createHttpError.BadRequest(message);
    }

    return Promise.resolve(
      jsonResponse(status.OK, {
        preferences: {
          notifications: {
            ...parsedEvent.data.preferences.notifications,
            updatedAt: new Date().toISOString(),
          },
        },
      }),
    );
  },
  {
    logLevel: "INFO",
    serviceName: "udp-patch-user-service",
    middlewares: [httpHeaderNormalizer(), httpJsonBodyParser()],
  },
);
