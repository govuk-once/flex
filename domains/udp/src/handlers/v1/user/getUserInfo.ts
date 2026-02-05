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

import { generateDerivedId } from "../../../service/derived-id";

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
    try {
      const { pairwiseId, notificationSecretKey } = context;

      const config = await getConfig(configSchema);

      const notificationId = generateDerivedId({
        pairwiseId,
        secretKey: notificationSecretKey,
      });

      const url = `${config.FLEX_PRIVATE_GATEWAY_URL}domains/udp/user`;
      const gatewayUrl = `${config.FLEX_PRIVATE_GATEWAY_URL}gateways/udp`;

      const signedFetch = createSignedFetcher({
        service: "execute-api",
        region: config.AWS_REGION,
      });

      const getUserResponse = await signedFetch(gatewayUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (getUserResponse.status === status.NOT_FOUND) {
        logger.info("User not found, creating user");
        const response = await signedFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notificationId,
          }),
        });

        if (!response.ok) {
          logger.warn("Private API returned non-OK", {
            status: response.status,
            statusText: response.statusText,
          });
          return jsonResponse(status.BAD_GATEWAY, {
            message: "Private API gateway returned error",
            status: response.status,
          });
        }

        return jsonResponse<HandlerResponse>(status.CREATED, {
          notificationId,
          preferences: {
            notificationsConsented: true,
            analyticsConsented: true,
            updatedAt: new Date().toISOString(),
          },
        });
      }

      return Promise.resolve(
        jsonResponse<HandlerResponse>(status.OK, {
          notificationId,
          preferences: {
            notificationsConsented: true,
            analyticsConsented: true,
            updatedAt: new Date().toISOString(),
          },
        }),
      );
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
