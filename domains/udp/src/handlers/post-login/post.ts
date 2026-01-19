import { createLambdaHandler } from "@flex/handlers";
import {
  type ContextWithPairwiseId,
  extractUser,
  type V2Authorizer,
} from "@flex/middlewares";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";

export const handlerResponseSchema = z.object({
  message: z.string(),
});

export type HandlerResponse = z.output<typeof handlerResponseSchema>;

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
  APIGatewayProxyResultV2<HandlerResponse>,
  ContextWithPairwiseId
>(
  async (_event: APIGatewayProxyEventV2, context: ContextWithPairwiseId) => {
    return Promise.resolve({
      statusCode: 201,
      body: JSON.stringify({
        message: "User created successfully!",
        userId: context.pairwiseId,
      }),
    });
  },
  {
    logLevel: "INFO",
    serviceName: "udp-user-creation-service",
    middlewares: [extractUser],
  },
);
