import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { getConfig } from "@flex/params";
import { jsonResponse, parseResponseBody } from "@flex/utils";
import type { APIGatewayProxyEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import status from "http-status";
import { z } from "zod";

import { type ApiResult, createUdpRemoteClient } from "./client";
import type { RemoteRouteMapping } from "./routes";
import { matchRemoteRoute } from "./routes";

const configSchema = z.object({
  AWS_REGION: z.string().min(1),
  FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN_PARAM_NAME: z.string().min(1),
});

const consumerConfigSchema = z.object({
  region: z.string().min(1),
  apiAccountId: z.string().min(1),
  apiUrl: z.string().min(1),
  consumerRoleArn: z.string().min(1),
  externalId: z.string().optional(),
});

type ConsumerConfig = z.output<typeof consumerConfigSchema>;

async function getConsumerConfig(secretArn: string): Promise<ConsumerConfig> {
  const config = await getSecret(secretArn);
  if (!config) {
    throw new Error("Consumer config not found");
  }
  return consumerConfigSchema.parse(JSON.parse(config));
}

const SERVICE_NAME = "app";

function parseRequestBody(body: string | null): unknown {
  if (!body) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

/**
 * Translates remote API result to internal response.
 * Maps ApiResult to HTTP response; identity translation when shapes match.
 */
function toHttpResponse<T>(result: ApiResult<T>): APIGatewayProxyResultV2 {
  if (result.ok) {
    return jsonResponse(result.status, result.data);
  }
  return jsonResponse(result.status, {
    message: result.error.message,
    ...(result.error.code && { code: result.error.code }),
  });
}

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

    const mapping = matchRemoteRoute(
      event.httpMethod,
      event.pathParameters?.proxy,
      stageName,
    );
    if (!mapping) {
      logger.warn("Route not registered in route config", { event });
      return jsonResponse(status.NOT_FOUND, { message: "Route not found" });
    }

    const body = parseRequestBody(event.body);
    const requestingServiceUserId =
      event.headers?.["requesting-service-user-id"] ?? "";

    const remoteClient = createUdpRemoteClient({
      region: consumerConfig.region,
      apiUrl: consumerConfig.apiUrl,
      consumerRoleArn: consumerConfig.consumerRoleArn,
      externalId: consumerConfig.externalId,
    });

    const result = await dispatch(
      remoteClient,
      mapping,
      body,
      requestingServiceUserId,
    );

    if ("rawResponse" in result) {
      const responseBody = await parseResponseBody(result.rawResponse);
      return jsonResponse(result.rawResponse.status, responseBody);
    }

    return toHttpResponse(result);
  },
  {
    serviceName: "udp-service-gateway",
  },
);

async function dispatch(
  client: ReturnType<typeof createUdpRemoteClient>,
  mapping: RemoteRouteMapping,
  body: unknown,
  requestingServiceUserId: string,
): Promise<ApiResult<unknown> | { rawResponse: Response }> {
  if (mapping.operation === "proxy") {
    const rawResponse = await client.call({
      method: mapping.method,
      path: mapping.remotePath,
      body,
      headers: mapping.requiresHeaders
        ? {
            "requesting-service": SERVICE_NAME,
            "requesting-service-user-id": requestingServiceUserId,
          }
        : undefined,
    });
    return { rawResponse };
  }

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
    default:
      throw new Error(`Unknown operation: ${mapping.operation}`);
  }
}

export { configSchema, handler };
