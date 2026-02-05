import { ApiGatewayEnvelope } from "@aws-lambda-powertools/parser/envelopes/api-gateway";
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { getConfig } from "@flex/params";
import { jsonResponse } from "@flex/utils";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { createSignedFetcher } from "aws-sigv4-fetch";
import createHttpError from "http-errors";
import status from "http-status";
import { z } from "zod";

import { generateDerivedId } from "../../../service/derived-id";

export const handlerResponseSchema = z.object({
  notificationId: z.string(),
});

const configSchema = z.object({
  FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: z.string().min(1),
  AWS_REGION: z.string().min(1),
});

export type HandlerResponse = z.output<typeof handlerResponseSchema>;

const handlerRequestSchema = z.object({
  notificationId: z.string(),
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

      const url = `${config.FLEX_PRIVATE_GATEWAY_URL}gateways/udp`;

      const signedFetch = createSignedFetcher({
        service: "execute-api",
        region: config.AWS_REGION,
      });
      const response = await signedFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId: parsedEvent.data.notificationId,
        }),
      });

      if (!response.ok) {
        logger.warn("Connector returned non-OK", {
          status: response.status,
          statusText: response.statusText,
        });
        return jsonResponse(status.BAD_GATEWAY, {
          message: "Connector returned error",
          status: response.status,
        });
      }

      return Promise.resolve(jsonResponse(status.CREATED, {}));
    } catch (error) {
      logger.debug("Failed to process request", { error });
      return Promise.resolve(
        jsonResponse(status.INTERNAL_SERVER_ERROR, {
          message: "Failed to process request",
        }),
      );
    }
  },
  {
    logLevel: "DEBUG",
    serviceName: "udp-post-user-service",
    middlewares: [httpHeaderNormalizer(), httpJsonBodyParser()],
  },
);
