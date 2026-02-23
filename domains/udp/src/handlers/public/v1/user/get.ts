import { createLambdaHandler } from "@flex/handlers";
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
import status from "http-status";
import { z } from "zod";

import { generateDerivedId } from "../../../../service/derived-id";
import { getUserProfile } from "../../../../service/userProfile";

export type NotificationSecretContext = {
  notificationSecretKey: string;
};

const configSchema = z.object({
  FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: z.string().min(1),
  AWS_REGION: z.string().min(1),
});

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
  APIGatewayProxyResultV2,
  ContextWithPairwiseId & NotificationSecretContext
>(
  async (_event, context) => {
    const { pairwiseId, notificationSecretKey } = context;
    const config = await getConfig(configSchema);
    const notificationId = generateDerivedId({
      pairwiseId,
      secretKey: notificationSecretKey,
    });

    const userProfile = await getUserProfile({
      region: config.AWS_REGION,
      baseUrl: config.FLEX_PRIVATE_GATEWAY_URL,
      notificationId,
      appId: pairwiseId,
    });

    return jsonResponse(status.OK, userProfile);
  },
  {
    logLevel: "INFO",
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
