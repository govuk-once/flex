import { ApiGatewayEnvelope } from "@aws-lambda-powertools/parser/envelopes/api-gateway";
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { getConfig } from "@flex/params";
import { jsonResponse } from "@flex/utils";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import type { APIGatewayProxyEvent } from "aws-lambda";
import createHttpError from "http-errors";
import status from "http-status";
import { z } from "zod";

import { createUser } from "../../services/createUser";

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

      const response = await createUser({
        privateGatewayUrl: config.FLEX_PRIVATE_GATEWAY_URL,
        awsRegion: config.AWS_REGION,
        pairwiseId: parsedEvent.data.appId,
        notificationId: parsedEvent.data.notificationId,
      });

      return jsonResponse(response.status, await response.json());
    } catch (error) {
      logger.error("Failed to process request", { error });
      if (createHttpError.isHttpError(error)) return error;
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
