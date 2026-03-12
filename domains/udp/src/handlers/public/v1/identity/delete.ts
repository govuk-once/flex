import { createUdpDomainClient } from "@client";
import { createLambdaHandler } from "@flex/handlers";
import {
  ContextWithUserId,
  extractUser,
  V2Authorizer,
} from "@flex/middlewares";
import { getConfig } from "@flex/params";
import { jsonResponse } from "@flex/utils";
import { deleteIdentityService } from "@services/identityService";
import {
  APIGatewayProxyResultV2,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from "aws-lambda";
import { status } from "http-status";
import z from "zod";

const configSchema = z.object({
  FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: z.string().min(1),
  AWS_REGION: z.string().min(1),
});

export const handler = createLambdaHandler<
  APIGatewayProxyWithLambdaAuthorizerEvent<V2Authorizer> & {
    pathParameters: { serviceName: string };
  },
  APIGatewayProxyResultV2,
  ContextWithUserId
>(
  async (event, context) => {
    const {
      pathParameters: { serviceName },
      context: { userId },
    } = { ...event, context };

    const config = await getConfig(configSchema);
    const client = createUdpDomainClient({
      region: config.AWS_REGION,
      baseUrl: config.FLEX_PRIVATE_GATEWAY_URL,
    });

    await deleteIdentityService({
      client,
      appId: userId,
      service: serviceName,
    });

    return jsonResponse(status.NO_CONTENT);
  },
  {
    serviceName: "udp-delete-identity-service",
    middlewares: [extractUser],
  },
);
