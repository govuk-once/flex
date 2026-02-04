import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import {
  type ContextWithPairwiseId,
  createSecretsMiddleware,
  extractUser,
  type V2Authorizer,
} from "@flex/middlewares";
import { jsonResponse } from "@flex/utils";
import type {
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { createSignedFetcher } from "aws-sigv4-fetch";
import status from "http-status";
import { z } from "zod";

import { generateDerivedId } from "../../../service/derived-id";

export const handlerResponseSchema = z.object({
  notificationId: z.string(),
});

export type NotificationSecretContext = {
  notificationSecretKey: string;
};

const configSchema = z.object({
  FLEX_PRIVATE_API_URL: z.string().url(),
  AWS_REGION: z.string().min(1),
});

export type HandlerResponse = z.output<typeof handlerResponseSchema>;

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
  APIGatewayProxyResultV2,
  ContextWithPairwiseId & NotificationSecretContext
>(
  async (_event, context) => {
    const logger = getLogger();

    const { pairwiseId, notificationSecretKey } = context;

    const notificationId = generateDerivedId({
      pairwiseId,
      secretKey: notificationSecretKey,
    });

    const config = configSchema.parse({
      FLEX_PRIVATE_API_URL: process.env.FLEX_PRIVATE_API_URL,
      AWS_REGION: process.env.AWS_REGION,
    });

    const baseUrl = config.FLEX_PRIVATE_API_URL.replace(/\/$/, "");
    const url = `${baseUrl}/internal/gateways/udp`;

    const signedFetch = createSignedFetcher({
      service: "execute-api",
      region: config.AWS_REGION,
    });
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

    return Promise.resolve(
      jsonResponse<HandlerResponse>(status.OK, {
        notificationId,
      }),
    );
  },
  {
    logLevel: "INFO",
    serviceName: "udp-post-user-service",
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
