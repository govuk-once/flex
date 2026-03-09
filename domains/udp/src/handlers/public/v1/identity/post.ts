import { createLambdaHandler } from "@flex/handlers";
import {
  type ContextWithUserId,
  extractUser,
  V2Authorizer,
} from "@flex/middlewares";
import { getConfig } from "@flex/params";
import { jsonResponse } from "@flex/utils";
import type {
  APIGatewayProxyResultV2,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from "aws-lambda";
import { status } from "http-status";
import { z } from "zod";

import { createUdpDomainClient } from "../../../../client";
import { postIdentityService } from "../../../../services/identityService";

const configSchema = z.object({
  FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: z.string().min(1),
  AWS_REGION: z.string().min(1),
});

export const handler = createLambdaHandler<
  APIGatewayProxyWithLambdaAuthorizerEvent<V2Authorizer> & {
    pathParameters: { serviceName: string; identifier: string };
  },
  APIGatewayProxyResultV2,
  ContextWithUserId
>(
  async (event, context) => {
    const {
      pathParameters: { serviceName, identifier },
      context: { userId },
    } = { ...event, context };

    const config = await getConfig(configSchema);
    const client = createUdpDomainClient({
      region: config.AWS_REGION,
      baseUrl: config.FLEX_PRIVATE_GATEWAY_URL,
    });

    await postIdentityService({
      appId: userId,
      client,
      service: serviceName,
      serviceId: identifier,
    });

    return jsonResponse(status.CREATED);
  },
  {
    serviceName: "udp-post-identity-service",
    middlewares: [extractUser],
  },
);
