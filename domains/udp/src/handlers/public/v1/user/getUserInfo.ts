import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import {
  type ContextWithPairwiseId,
  createSecretsMiddleware,
  extractUser,
  type V2Authorizer,
} from "@flex/middlewares";
import { getConfig } from "@flex/params";
import { jsonResponse, sigv4Fetch } from "@flex/utils";
import type {
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
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

const SERVICE_NAME = "GOVUK-APP";

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

      const notificationsResponse = await sigv4Fetch({
        region: config.AWS_REGION,
        path: `${baseUrl.pathname}/gateways/udp/v1/notifications`,
        method: "POST",
        baseUrl: baseUrl.toString(),
        headers: {
          "requesting-service": SERVICE_NAME,
          "requesting-service-user-id": pairwiseId,
        },
        body: {
          data: {
            consentStatus: "unknown",
          },
        },
      });

      const responseBody = await notificationsResponse.json();
      logger.info("User info response", {
        body: responseBody,
        status: notificationsResponse.status,
      });

      if (
        !notificationsResponse.ok &&
        notificationsResponse.status !== status.NOT_FOUND
      ) {
        logger.warn("Private API returned non-OK", {
          status: notificationsResponse.status,
          statusText: notificationsResponse.statusText,
        });
        return jsonResponse(status.BAD_GATEWAY, {
          message: "Private API gateway returned error",
          status: notificationsResponse.status,
        });
      }

      logger.info("User not found, creating user");
      const response = await sigv4Fetch({
        region: config.AWS_REGION,
        baseUrl: baseUrl.toString(),
        path: `${baseUrl.pathname}/domains/udp/v1/user`,
        method: "POST",
        body: {
          notificationId,
          appId: pairwiseId,
        },
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

      return jsonResponse(status.OK, {
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
      });
    } catch (error) {
      logger.error("Failed to get user info", { error });
      return jsonResponse(status.INTERNAL_SERVER_ERROR, {
        message: "Failed to get user info",
      });
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
