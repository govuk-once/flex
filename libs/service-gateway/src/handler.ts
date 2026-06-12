import { logger } from "@flex/logging";
import { createNormalizeInboundPath } from "@flex/platform-shared";
import { jsonResponse } from "@flex/utils";
import type { APIGatewayProxyResultV2 } from "aws-lambda";
import createHttpError from "http-errors";

import { clearTmp } from "../utils";
import {
  HeaderValidationError,
  QueryParametersParseError,
  RequestBodyParseError,
} from "../utils/errors";
import { createDownstreamClient } from "./client";
import { buildHandlerContext } from "./handler-context";
import { buildMiddleware } from "./middleware";
import type {
  GatewayConfig,
  GatewayHandler,
  GatewayHandlerMap,
  GatewayLambda,
} from "./types";
import { buildRoutes, lookupRoute } from "./utils/routes";

export function buildHandler<Config extends GatewayConfig>(
  config: Config,
  handlers: GatewayHandlerMap<Config>,
): GatewayLambda {
  logger.setServiceName(`${config.name}-service-gateway`);
  logger.setLogLevel("INFO");

  const routes = buildRoutes(config.routes);
  const middleware = buildMiddleware({ logger });
  const normaliseInboundPath = createNormalizeInboundPath(
    `/gateways/${config.name}`,
  );

  const coreHandler: GatewayLambda = async (event) => {
    try {
      const client = await createDownstreamClient(config);

      const route = lookupRoute(
        routes,
        event.httpMethod,
        normaliseInboundPath(event.path),
      );

      if (!route) {
        throw new createHttpError.NotFound("Route not found");
      }

      const handler = handlers[route.key] as GatewayHandler | undefined;

      if (!handler) {
        throw new createHttpError.NotFound("Route handler not found");
      }

      const result = await handler(
        buildHandlerContext(event, { client, logger, route }),
      );

      if (!result.ok) {
        return throwGatewayResponse(config.name.toUpperCase(), result.error);
      }

      return jsonResponse(result.status, result.data);
    } catch (error) {
      if (error instanceof HeaderValidationError) {
        logger.warn("Missing required headers", { headers: error.headers });

        return jsonResponse(error.statusCode, {
          message: error.message,
          headers: error.headers,
        });
      }

      if (error instanceof QueryParametersParseError) {
        logger.warn("Invalid query parameters", { errors: error.errors });

        return jsonResponse(error.statusCode, {
          message: error.message,
          errors: error.errors,
        });
      }

      if (error instanceof RequestBodyParseError) {
        logger.warn("Invalid request body", { message: error.message });

        return jsonResponse(error.statusCode, { message: error.message });
      }

      if (createHttpError.isHttpError(error)) {
        const logLevel = isServerError(error.statusCode) ? "error" : "warn";

        logger[logLevel](error.message, { statusCode: error.statusCode });

        return jsonResponse(error.statusCode, { message: error.message });
      }

      logger.error("Internal server error", { error });

      return jsonResponse(500, { message: "Internal server error" });
    } finally {
      clearTmp();
    }
  };

  return middleware.handler(coreHandler);
}

function isClientError(status: number) {
  return status >= 400 && status < 500;
}

function isServerError(status: number) {
  return status >= 500;
}

function throwGatewayResponse(
  name: string,
  error: { status: number; message: string; body?: unknown },
): APIGatewayProxyResultV2 {
  logger.debug("Mapping remote error to gateway response", { error });

  const { message, status, body } = error;

  if (isServerError(status)) {
    const message = `${name} upstream service unavailable`;

    logger.debug(message, { error });

    return jsonResponse(502, { message });
  }

  return jsonResponse(error.status, {
    message,
    ...(isClientError(status) && body !== undefined ? { error: body } : {}),
  });
}
