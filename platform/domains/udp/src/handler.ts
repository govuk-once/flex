import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { getConfig } from "@flex/params";
import type { APIGatewayProxyEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";

import { type ApiResult, createUdpRemoteClient } from "./client";
import type { RemoteRouteMapping } from "./routes";
import { getConsumerConfig } from "./utils/getConsumerConfig";
import { resolveRequest } from "./utils/resolver";
import { toHttpResponse } from "./utils/toHttpResponse";

const configSchema = z.object({
  AWS_REGION: z.string().min(1),
  FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN_PARAM_NAME: z.string().min(1),
});

/**
 * UDP connector (service gateway) – internal-only, invoked via the private API gateway.
 *
 * Receives Flex requests, routes to typed remote client methods, validates and
 * translates remote responses to internal contract. No direct invocation from domain lambdas.
 */
const handler = createLambdaHandler<
  APIGatewayProxyEvent,
  APIGatewayProxyResultV2
>(
  async (event) => {
    const logger = getLogger();
    const config = await getConfig(configSchema);
    const consumerConfig = await getConsumerConfig(
      config.FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN,
    );
    const baseUrl = new URL(consumerConfig.apiUrl);
    const stageName = baseUrl.pathname;

    const resolveResult = resolveRequest(event, stageName, logger);
    if (!resolveResult.ok) {
      return resolveResult.response;
    }
    const { mapping, body, requestingServiceUserId } = resolveResult.request;

    const remoteClient = createUdpRemoteClient(consumerConfig);

    const result = await dispatch(
      logger,
      remoteClient,
      mapping,
      body,
      requestingServiceUserId,
    );

    return toHttpResponse(result);
  },
  {
    serviceName: "udp-service-gateway",
  },
);

async function dispatch(
  logger: ReturnType<typeof getLogger>,
  client: ReturnType<typeof createUdpRemoteClient>,
  mapping: RemoteRouteMapping,
  body: unknown,
  requestingServiceUserId: string,
): Promise<ApiResult<unknown>> {
  logger.debug("Dispatching", { mapping, body, requestingServiceUserId });
  switch (mapping.operation) {
    case "getNotifications":
      return client.getNotifications(requestingServiceUserId);
    case "postNotifications":
      return await client.postNotifications(
        body as { data: { consentStatus: string; updatedAt: string } },
        requestingServiceUserId,
      );
    case "postUser":
      return await client.postUser(
        body as { notificationId: string; appId: string },
      );
    default: {
      const _exhaustive: never = mapping.operation;
      throw new Error(`Unknown operation: ${String(_exhaustive)}`);
    }
  }
}

export { configSchema, handler };
