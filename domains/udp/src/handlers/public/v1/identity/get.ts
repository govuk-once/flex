import { createUdpDomainClient } from "@client";
import { createLambdaHandler } from "@flex/handlers";
import {
  type ContextWithUserId,
  extractUser,
  V2Authorizer,
} from "@flex/middlewares";
import { getConfig } from "@flex/params";
import { jsonResponse, validatePathParams } from "@flex/utils";
import { configSchema, getIdentityPathSchema } from "@schemas/identity";
import { getIdentityService } from "@services/identityService";
import type {
  APIGatewayProxyResultV2,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from "aws-lambda";
import { status } from "http-status";

export const handler = createLambdaHandler<
  APIGatewayProxyWithLambdaAuthorizerEvent<V2Authorizer> & {
    pathParameters: { serviceName: string };
  },
  APIGatewayProxyResultV2,
  ContextWithUserId
>(
  async (event, context) => {
    const userId = context.userId;
    const { serviceName } = validatePathParams(
      getIdentityPathSchema,
      event.pathParameters,
    );

    const config = await getConfig(configSchema);
    const client = createUdpDomainClient({
      region: config.AWS_REGION,
      baseUrl: config.FLEX_PRIVATE_GATEWAY_URL,
    });

    const response = await getIdentityService({
      client,
      userId,
      service: serviceName,
    });

    return jsonResponse(status.OK, response);
  },
  {
    serviceName: "udp-get-identity-service",
    middlewares: [extractUser],
  },
);
