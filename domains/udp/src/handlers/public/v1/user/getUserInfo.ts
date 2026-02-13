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
import type {
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import createHttpError from "http-errors";
import status from "http-status";
import { z } from "zod";

import { aggregateUserProfile } from "../../../../service/aggregateUserProfile";
import { generateDerivedId } from "../../../../service/derived-id";

export const configSchema = z.looseObject({
  FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: z.string().min(1),
  AWS_REGION: z.string().min(1),
});

export const handlerResponseSchema = z.object({
  notificationId: z.string(),
  preferences: z.object({
    notificationsConsented: z.boolean().optional(),
    analyticsConsented: z.boolean().optional(),
    updatedAt: z.string(),
  }),
});

export type NotificationSecretContext = {
  notificationSecretKey: string;
};

export type HandlerResponse = z.output<typeof handlerResponseSchema>;

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
  APIGatewayProxyResultV2,
  ContextWithPairwiseId & NotificationSecretContext
>(
  async (_event, context) => {
    const logger = getLogger();
    const { pairwiseId, notificationSecretKey } = context;

    try {
      const config = await getConfig(configSchema);

      const baseUrl = new URL(config.FLEX_PRIVATE_GATEWAY_URL);

      const notificationId = generateDerivedId({
        pairwiseId,
        secretKey: notificationSecretKey,
      });

      const userProfile = await aggregateUserProfile({
        region: config.AWS_REGION,
        baseUrl,
        pairwiseId,
        notificationId,
      });
      return jsonResponse(status.OK, {
        notificationId,
        preferences: userProfile,
      });
    } catch (error) {
      logger.error("Failed to get user info", { error });

      if (error instanceof createHttpError.BadGateway) return error;

      return jsonResponse(status.INTERNAL_SERVER_ERROR, {
        message: "Failed to get user info",
      });
    }
  },
  {
    serviceName: "udp-get-user-service",
    middlewares: [
      extractUser,
      createSecretsMiddleware<NotificationSecretContext>({
        secrets: {
          notificationSecretKey: process.env.FLEX_UDP_NOTIFICATION_SECRET,
        },
      }),
    ],
  },
);
