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
import { createSignedFetcher } from "aws-sigv4-fetch";
import status from "http-status";
import { z } from "zod";

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
    const { pairwiseId, notificationSecretKey } = context;

    const notificationId = generateDerivedId({
      pairwiseId,
      secretKey: notificationSecretKey,
    });

    return Promise.resolve(
      jsonResponse(status.OK, {
        notificationId,
        preferences: {
          notifications: {
            consentStatus: "unknown",
            updatedAt: new Date().toISOString(),
          },
          analytics: {
            consentStatus: "unknown",
            updatedAt: new Date().toISOString(),
          },
        },
      }),
    );
  },
  {
    logLevel: "DEBUG",
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
