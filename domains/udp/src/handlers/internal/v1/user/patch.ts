import { ApiGatewayEnvelope } from "@aws-lambda-powertools/parser/envelopes/api-gateway";
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { getConfig } from "@flex/params";
import { getHeader, jsonResponse } from "@flex/utils";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import type { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";
import status from "http-status";
import { z } from "zod";

import { createUdpDomainClient } from "../../../../client";

export const handlerRequestSchema = z.object({
  preferences: z.object({
    notifications: z.object({
      consentStatus: z.enum(["accepted", "denied", "unknown"]),
    }),
  }),
});

const configSchema = z.object({
  FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: z.string().min(1),
  AWS_REGION: z.string().min(1),
});

export const handler = createLambdaHandler<APIGatewayProxyEvent>(
  async (event) => {
    const logger = getLogger();

    const requestingServiceUserId = getHeader(
      event,
      "requesting-service-user-id",
    );
    if (!requestingServiceUserId) {
      throw new createHttpError.BadRequest(
        "Missing requesting-service-user-id header",
      );
    }

    const parsedEvent = ApiGatewayEnvelope.safeParse(
      event,
      handlerRequestSchema,
    );

    if (!parsedEvent.success) {
      const message = `Invalid parsed event: ${parsedEvent.error.message}`;
      logger.debug(message);
      throw new createHttpError.BadRequest(message);
    }

    const config = await getConfig(configSchema);
    const client = createUdpDomainClient({
      region: config.AWS_REGION,
      baseUrl: config.FLEX_PRIVATE_GATEWAY_URL,
    });

    const response = await client.gateway.updatePreferences(
      parsedEvent.data,
      requestingServiceUserId,
    );

    if (!response.ok) {
      logger.error("Failed to update user preferences", {
        response: JSON.stringify(response),
        status: response.error.body,
      });
      throw new createHttpError.BadGateway();
    }

    return jsonResponse(status.OK, response.data);
  },
  {
    logLevel: "INFO",
    serviceName: "udp-patch-user-service",
    middlewares: [httpHeaderNormalizer(), httpJsonBodyParser()],
  },
);
