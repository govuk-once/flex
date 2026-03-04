import { ApiGatewayEnvelope } from "@aws-lambda-powertools/parser/envelopes/api-gateway";
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { getConfig } from "@flex/params";
import { jsonResponse, NonEmptyString } from "@flex/utils";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import type { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";
import status from "http-status";
import { z } from "zod";

import { createUdpDomainClient } from "../../../../client";

const configSchema = z.object({
  FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: NonEmptyString,
  AWS_REGION: NonEmptyString,
});

const handlerRequestSchema = z.object({
  notificationId: NonEmptyString,
  appId: NonEmptyString,
});

export const handler = createLambdaHandler<APIGatewayProxyEvent>(
  async (event) => {
    const logger = getLogger();
    try {
      const parsedEvent = ApiGatewayEnvelope.safeParse(
        event,
        handlerRequestSchema,
      );

      if (!parsedEvent.success) {
        const message = `Invalid parsed event: ${parsedEvent.error.message}`;
        throw new createHttpError.BadRequest(message);
      }

      const config = await getConfig(configSchema);

      const client = createUdpDomainClient({
        region: config.AWS_REGION,
        baseUrl: config.FLEX_PRIVATE_GATEWAY_URL,
      });

      const response = await client.gateway.createUser({
        notificationId: parsedEvent.data.notificationId,
        appId: parsedEvent.data.appId,
      });

      if (!response.ok) {
        logger.error("Failed to create user", {
          response: JSON.stringify(response),
          status: response.error.body,
        });
        throw new createHttpError.BadGateway();
      }

      return jsonResponse(status.NO_CONTENT);
    } catch (error) {
      logger.error("Failed to process request", { error });
      if (createHttpError.isHttpError(error)) throw error;
      return jsonResponse(status.INTERNAL_SERVER_ERROR, {
        message: "Failed to process request",
      });
    }
  },
  {
    serviceName: "udp-post-user-service",
    middlewares: [httpHeaderNormalizer(), httpJsonBodyParser()],
  },
);
