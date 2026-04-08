import { createLambdaHandler } from "@flex/handlers";
import { logger } from "@flex/logging";
import { getConfig } from "@flex/params";
import { getConsumerConfig } from "@flex/sdk-service-gw";
import { jsonResponse } from "@flex/utils";
import type { APIGatewayProxyEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import createHttpError from "http-errors";

import { createDvlaRemoteClient } from "../client";
import { execute } from "../contract/executor";
import { configSchema, consumerConfigSchema } from "../schemas/config";

/**
 * DVLA Service Gateway – internal-only, invoked via the private API gateway.
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
        config.FLEX_DVLA_CONSUMER_CONFIG_SECRET_ARN,
        consumerConfigSchema,
      );

      const remoteClient = createDvlaRemoteClient(consumerConfig);
      const result = await execute(event, remoteClient);

      if (!result.ok) {
        return mapRemoteErrorToGatewayResponse(result.error);
      }

      return jsonResponse(result.status, result.data);
    } catch (error) {
      logger.error("Internal server error", { error });
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
    serviceName: "dvla-service-gateway",
  },
);

function mapRemoteErrorToGatewayResponse(error: {
  status: number;
  message: string;
  body?: unknown;
}): APIGatewayProxyResultV2 {
  logger.debug("Mapping remote error to gateway response", { error });
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
