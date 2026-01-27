import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import {
  type ContextWithPairwiseId,
  createSecretsMiddleware,
  extractUser,
  type V2Authorizer,
} from "@flex/middlewares";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";

import { generateDerivedId } from "../../service/derived-id";

export const handlerResponseSchema = z.object({
  message: z.string(),
  userId: z.string(),
});

type NotificationSecretContext = {
  secretKey: string;
};

export type HandlerResponse = z.output<typeof handlerResponseSchema>;

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
  APIGatewayProxyResultV2<HandlerResponse>,
  ContextWithPairwiseId & NotificationSecretContext
>(
  async (_event: APIGatewayProxyEventV2, context) => {
    const { pairwiseId, secretKey } = context;

    const notificationId = generateDerivedId({
      pairwiseId,
      secretKey,
    });

    return Promise.resolve({
      statusCode: 201,
      body: JSON.stringify({
        message: "User created successfully!",
        userId: pairwiseId,
        notificationId,
      }),
    });
  },
  {
    logLevel: "INFO",
    serviceName: "udp-user-creation-service",
    middlewares: [
      extractUser,
      createSecretsMiddleware<NotificationSecretContext>({
        secrets: {
          secretKey: "/development/flex-secret/udp/notification-hash-secret",
        },
      }),
    ],
  },
);
