import { logger } from "@flex/logging";
import {
  HeaderValidationError,
  isClientError,
  isServerError,
  jsonResponse,
  QueryParametersParseError,
  RequestBodyParseError,
  stripPathPrefix,
} from "@flex/utils";
import type { APIGatewayProxyResultV2 } from "aws-lambda";
import createHttpError from "http-errors";

import { createDownstreamClient } from "../client";
import type {
  GatewayConfig,
  GatewayHandler,
  GatewayHandlerMap,
  GatewayLambda,
} from "../types";
import { clearTmp } from "../utils/cleanup";
import { buildRoutes, lookupRoute } from "../utils/routes";
import { buildContext } from "./context";
import { buildMiddleware } from "./middleware";

export function buildHandler<Config extends GatewayConfig>(
  config: Config,
  handlers: GatewayHandlerMap<Config>,
): GatewayLambda {
  logger.setServiceName(`${config.name}-service-gateway`);
  logger.setLogLevel("INFO");

  const gatewayPathPrefix = `/gateways/${config.name}`;

  const routes = buildRoutes(config.routes);
  const middleware = buildMiddleware({ logger });

  const coreHandler: GatewayLambda = async (event) => {
    try {
      const inboundPath = stripPathPrefix(event.path, gatewayPathPrefix);
      const route = lookupRoute(routes, event.httpMethod, inboundPath);

      if (!route) {
        throw new createHttpError.NotFound("Route not found");
      }

      const handler = handlers[route.key] as GatewayHandler | undefined;

      if (!handler) {
        throw new createHttpError.NotFound("Route handler not found");
      }

      const client = await createDownstreamClient(config);
      const result = await handler(
        buildContext(event, { client, logger, route }),
      );

      if (!result.ok) {
        return toGatewayErrorResponse(config.name.toUpperCase(), result.error);
      }

      return jsonResponse(result.status, result.data);
    } catch (error) {
      if (error instanceof HeaderValidationError) {
        const { headers, message, statusCode } = error;

        logger.warn("Missing required headers", { headers });

        return jsonResponse(statusCode, { message, headers });
      }

      if (error instanceof QueryParametersParseError) {
        const { errors, message, statusCode } = error;

        logger.warn("Invalid query parameters", { errors });

        return jsonResponse(statusCode, { message, errors });
      }

      if (error instanceof RequestBodyParseError) {
        const { message, statusCode } = error;

        logger.warn("Invalid request body", { message });

        return jsonResponse(statusCode, { message });
      }

      if (createHttpError.isHttpError(error)) {
        const { message, statusCode } = error;

        const logLevel = isServerError(statusCode) ? "error" : "warn";

        logger[logLevel](message, { statusCode });

        return jsonResponse(statusCode, { message });
      }

      logger.error("Internal server error", { error });

      return jsonResponse(500, { message: "Internal server error" });
    } finally {
      clearTmp();
    }
  };

  return middleware.handler(coreHandler);
}

function toGatewayErrorResponse(
  name: string,
  error: { status: number; message: string; body?: unknown },
): APIGatewayProxyResultV2 {
  logger.debug("Mapping remote error to gateway response", { error });

  const { message, status, body } = error;

  if (isServerError(status)) {
    const errorMessage = `${name} upstream service unavailable`;

    logger.debug(errorMessage, { error });

    return jsonResponse(502, { message: errorMessage });
  }

  return jsonResponse(status, {
    message,
    ...(isClientError(status) && body !== undefined ? { error: body } : {}),
  });
}
