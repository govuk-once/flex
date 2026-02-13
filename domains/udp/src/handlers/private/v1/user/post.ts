import { ApiGatewayEnvelope } from "@aws-lambda-powertools/parser/envelopes/api-gateway";
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { getConfig } from "@flex/params";
import { jsonResponse, sigv4Fetch } from "@flex/utils";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import type { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";
import status from "http-status";
import { z } from "zod";

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
  appId: z.string(),
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

      const url = `${config.FLEX_PRIVATE_GATEWAY_URL}/gateways/udp`;

      const response = await sigv4Fetch({
        region: config.AWS_REGION,
        path: `${url}/v1/user`,
        method: "POST",
        baseUrl: url,
        body: {
          notificationId: parsedEvent.data.notificationId,
          appId: parsedEvent.data.appId,
        },
      });

      const responseBody = await response.json();
      return Promise.resolve(jsonResponse(response.status, responseBody));
    } catch (error) {
      logger.debug("Failed to process request", { error });
      if (error instanceof createHttpError.BadRequest) return error;
      return Promise.resolve(
        jsonResponse(status.INTERNAL_SERVER_ERROR, {
          message: "Failed to process request",
        }),
      );
    }
  },
  {
    serviceName: "udp-post-user-service",
    middlewares: [httpHeaderNormalizer(), httpJsonBodyParser()],
  },
);
