import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { getConfig } from "@flex/params";
import type { APIGatewayProxyEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import status from "http-status";
import { z } from "zod";

import { type ApiResult, createUdpRemoteClient } from "./client";
import type { RemoteRouteMapping } from "./routes";
import { matchRemoteRoute } from "./routes";
import { toHttpResponse } from "./utils/toHttpResponse";
import { getHeader } from "./utils/getHeader";
import { getConsumerConfig } from "./utils/getConsumerConfig";
import { jsonResponse } from "@flex/utils";

const configSchema = z.object({
  AWS_REGION: z.string().min(1),
  FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN_PARAM_NAME: z.string().min(1),
});

function parseRequestBody(body: string | null): unknown {
  if (!body) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

type ResolvedRequest = {
  mapping: RemoteRouteMapping;
  body: unknown;
  requestingServiceUserId: string;
};

type ResolveResult =
  | { ok: true; request: ResolvedRequest }
  | { ok: false; response: APIGatewayProxyResultV2 };

/**
 * Validates input (including headers) and matches the route in a single step.
 * Returns resolved request or an error response.
 */
function resolveRequest(
  event: APIGatewayProxyEvent,
  stageName: string,
  logger: ReturnType<typeof getLogger>,
): ResolveResult {
  const mapping = matchRemoteRoute(
    event.httpMethod,
    event.pathParameters?.proxy,
    stageName,
  );
  if (!mapping) {
    logger.warn("Route not registered in route config", { event });
    return {
      ok: false,
      response: jsonResponse(status.NOT_FOUND, { message: "Route not found" }),
    };
  }

  const requestingServiceUserId =
    getHeader(event, "requesting-service-user-id")?.trim() ?? "";

  if (mapping.requiresHeaders && !requestingServiceUserId) {
    logger.warn("Missing required requesting-service-user-id header", {
      mapping,
    });
    return {
      ok: false,
      response: jsonResponse(status.BAD_REQUEST, {
        message: "requesting-service-user-id header is required for this route",
      }),
    };
  }

  const body = parseRequestBody(event.body);
  return {
    ok: true,
    request: { mapping, body, requestingServiceUserId },
  };
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
