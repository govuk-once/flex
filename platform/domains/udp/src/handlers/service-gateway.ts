import { ApiResult } from "@flex/flex-fetch";
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { getConfig } from "@flex/params";
import { jsonResponse } from "@flex/utils";
import type { APIGatewayProxyEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import createHttpError from "http-errors";
import { z } from "zod";

import type { UdpRemoteClient } from "../client";
import { createUdpRemoteClient } from "../client";
import { resolveRequest } from "../contract/resolver";
import type { ResolvedRequest } from "../contract/types";
import { getConsumerConfig } from "../utils/getConsumerConfig";

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
export const handler = createLambdaHandler<
  APIGatewayProxyEvent,
  APIGatewayProxyResultV2
>(
  async (event) => {
    try {
      const config = await getConfig(configSchema);
      const consumerConfig = await getConsumerConfig(
        config.FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN,
      );
      const resolveResult = await resolveRequest(event);
      const remoteClient = createUdpRemoteClient(consumerConfig);
      const result = await dispatch(remoteClient, resolveResult);

      if (!result.ok) {
        return mapRemoteErrorToGatewayResponse(result.error);
      }

      return jsonResponse(result.status, result.data);
    } catch (error) {
      if (createHttpError.isHttpError(error)) {
        return jsonResponse(error.statusCode, {
          message: error.message,
        });
      }

      return jsonResponse(500, {
        message: "Internal server error",
      });
    }
  },
  {
    serviceName: "udp-service-gateway",
  },
);

async function dispatch(
  client: UdpRemoteClient,
  request: ResolvedRequest,
): Promise<ApiResult<unknown>> {
  const logger = getLogger();
  logger.debug("Dispatching", { operation: request.operation });
  switch (request.operation) {
    case "getNotifications":
      return client.getPreferences(request.requestingServiceUserId);
    case "updateNotifications":
      return await client.updatePreferences(
        request.remoteBody,
        request.requestingServiceUserId,
      );
    case "createUser":
      return await client.createUser(request.remoteBody);
  }
}

function mapRemoteErrorToGatewayResponse(error: {
  status: number;
  message: string;
  body?: unknown;
}): APIGatewayProxyResultV2 {
  const logger = getLogger();
  if (error.status >= 500) {
    logger.debug("UDP upstream service unavailable", { error });
    return jsonResponse(502, {
      message: "UDP upstream service unavailable",
    });
  }

  return jsonResponse(error.status, {
    message: error.message,
    ...(error.status >= 400 && error.status < 500 && error.body !== undefined
      ? { error: error.body }
      : {}),
  });
}
