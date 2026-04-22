import { injectLambdaContext, logger } from "@flex/logging";
import { clearTmp } from "@flex/sdk";
import { jsonResponse, NonEmptyString } from "@flex/utils";
import middy, { MiddyfiedHandler } from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import createHttpError from "http-errors";
import z from "zod";

import { createDvlaRemoteClient } from "../client";
import { execute } from "../contract/executor";
import { getConsumerConfig } from "../utils/getConsumerConfig";

const configSchema = z.object({
  AWS_REGION: NonEmptyString,
  FLEX_DVLA_CONSUMER_CONFIG_SECRET_ARN: NonEmptyString,
});

/**
 * DVLA Service Gateway – internal-only, invoked via the private API gateway.
 *
 * Receives Flex requests, routes to typed remote client methods, validates and
 * translates remote responses to internal contract. No direct invocation from domain lambdas.
 */
export const handler: MiddyfiedHandler<
  APIGatewayProxyEvent,
  APIGatewayProxyResultV2
> = middy<APIGatewayProxyEvent, APIGatewayProxyResultV2>()
  .use(
    injectLambdaContext(logger, {
      clearState: true,
      correlationIdPath: "requestContext.requestId",
    }),
  )
  .handler(async (event) => {
    logger.setServiceName("dvla-service-gateway");
    logger.setLogLevel("INFO");

    try {
      const config = configSchema.parse(process.env);
      const consumerConfig = await getConsumerConfig(
        config.FLEX_DVLA_CONSUMER_CONFIG_SECRET_ARN,
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
    } finally {
      clearTmp();
    }
  });

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
