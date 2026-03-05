import { createLambdaHandler } from "@flex/handlers";
import {
  type ContextWithUserId,
  createSecretsMiddleware,
  extractUser,
  type V2Authorizer,
} from "@flex/middlewares";
import { getConfig } from "@flex/params";
import { jsonResponse, NonEmptyString } from "@flex/utils";
import { NotificationSecretContext } from "@schemas/notifications";
import { getNotificationId } from "@services/getNotificationId";
import { getUserProfile } from "@services/userProfile";
import type {
  APIGatewayProxyResultV2,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from "aws-lambda";
import status from "http-status";
import { z } from "zod";

const configSchema = z.object({
  FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: NonEmptyString,
  AWS_REGION: NonEmptyString,
});

export const handler = createLambdaHandler<
  APIGatewayProxyWithLambdaAuthorizerEvent<V2Authorizer>,
  APIGatewayProxyResultV2,
  ContextWithUserId & NotificationSecretContext
>(
  async (_event, context) => {
    const { userId, notificationSecretKey } = context;
    const config = await getConfig(configSchema);
    const notificationId = getNotificationId({
      userId,
      secretKey: notificationSecretKey,
    });

    const userProfile = await getUserProfile({
      region: config.AWS_REGION,
      baseUrl: config.FLEX_PRIVATE_GATEWAY_URL,
      notificationId,
      userId,
    });

    return jsonResponse(status.OK, userProfile);
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
