import { ApiGatewayEnvelope } from "@aws-lambda-powertools/parser/envelopes/api-gateway";
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import {
  type ContextWithPairwiseId,
  createSecretsMiddleware,
  extractUser,
  type V2Authorizer,
} from "@flex/middlewares";
import { getConfig } from "@flex/params";
import { jsonResponse } from "@flex/utils";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import type {
  APIGatewayProxyResultV2,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from "aws-lambda";
import createHttpError from "http-errors";
import status from "http-status";
import { z } from "zod";

import { createUdpDomainClient } from "../../../../client";
import { updateNotificationRequestSchema } from "../../../../schemas/notifications";
import { generateDerivedId } from "../../../../service/derived-id";

export type NotificationSecretContext = {
  notificationSecretKey: string;
};

const configSchema = z.object({
  FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: z.string().min(1),
  AWS_REGION: z.string().min(1),
});

export const handler = createLambdaHandler<
  APIGatewayProxyWithLambdaAuthorizerEvent<V2Authorizer>,
  APIGatewayProxyResultV2,
  ContextWithPairwiseId & NotificationSecretContext
>(
  async (event, context) => {
    const logger = getLogger();
    const parsedEvent = ApiGatewayEnvelope.safeParse(
      event,
      updateNotificationRequestSchema,
    );

    if (!parsedEvent.success) {
      const message = `Invalid parsed event: ${parsedEvent.error.message}`;
      throw new createHttpError.BadRequest(message);
    }

    const notificationId = generateDerivedId({
      pairwiseId: context.pairwiseId,
      secretKey: context.notificationSecretKey,
    });

    const config = await getConfig(configSchema);
    const client = createUdpDomainClient({
      region: config.AWS_REGION,
      baseUrl: config.FLEX_PRIVATE_GATEWAY_URL,
    });
    const response = await client.gateway.notifications.update(
      context.pairwiseId,
      {
        consentStatus: parsedEvent.data.consentStatus,
        notificationId,
      },
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
    serviceName: "udp-patch-user-service",
    middlewares: [
      extractUser,
      httpHeaderNormalizer(),
      httpJsonBodyParser(),
      createSecretsMiddleware<NotificationSecretContext>({
        secrets: {
          notificationSecretKey: process.env.FLEX_UDP_NOTIFICATION_SECRET,
        },
      }),
    ],
  },
);
