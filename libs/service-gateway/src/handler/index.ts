import { logger } from "@flex/logging";
import { clearTmp } from "@flex/sdk";
import { emitTelemetry, TelemetryEvent } from "@flex/telemetry";
import { jsonResponse, stripPathPrefix } from "@flex/utils";
import createHttpError from "http-errors";
import { z } from "zod";

import type {
  GatewayClientMap,
  GatewayConfig,
  GatewayHandlerInput,
  GatewayLambda,
  GatewayRouteHandler,
  RouteKeyOf,
} from "../types";
import { resolveResources } from "../utils/resources";
import {
  toDownstreamErrorResponse,
  toGatewayErrorResponse,
} from "../utils/response";
import { buildRoutes, lookupRoute } from "../utils/routes";
import { buildContext } from "./context";
import { buildMiddleware } from "./middleware";

export function buildHandler<
  Config extends GatewayConfig,
  Clients extends GatewayClientMap,
>(
  config: Config,
  gateway: GatewayHandlerInput<Config, Clients>,
): GatewayLambda {
  logger.setServiceName(`${config.name}-service-gateway`);
  logger.setLogLevel("INFO");

  const gatewayPathPrefix = `/gateways/${config.name}`;

  const routes = buildRoutes(config.routes);
  const middleware = buildMiddleware({ logger });

  const findRouteHandler = (key: RouteKeyOf<Config>) =>
    gateway.routes[key] as GatewayRouteHandler | undefined;

  const coreHandler: GatewayLambda = async (event) => {
    try {
      const inboundPath = stripPathPrefix(event.path, gatewayPathPrefix);

      emitTelemetry(TelemetryEvent.service_gateway_request_received, {
        method: event.httpMethod,
        path: inboundPath,
      });

      const route = lookupRoute(routes, event.httpMethod, inboundPath);

      if (!route) {
        throw new createHttpError.NotFound("Route not found");
      }

      const handler = findRouteHandler(route.key);

      if (!handler) {
        throw new createHttpError.NotFound("Route handler not found");
      }

      const resources = await resolveResources<Config["resources"]>(
        config.resources,
      );

      const clients = gateway.clients(resources);

      const context = buildContext(event, {
        clients,
        resources,
        logger,
        route,
      });

      const result = await handler(context);

      if (!result.ok) {
        return toDownstreamErrorResponse(
          config.name.toUpperCase(),
          result.error,
        );
      }

      if (route.config.response) {
        const parsed = route.config.response.safeParse(result.data);

        if (!parsed.success) {
          logger.error("Gateway response schema validation failed", {
            issues: z.prettifyError(parsed.error),
          });
          emitTelemetry(TelemetryEvent.response_validation_failed, {
            path: event.path,
          });
          emitTelemetry(TelemetryEvent.service_gateway_error_returned, {
            status: 502,
          });

          return jsonResponse(502, {
            message: `${config.name.toUpperCase()} upstream response invalid`,
          });
        }
      }

      emitTelemetry(TelemetryEvent.service_gateway_response_returned, {
        status: result.status,
      });

      return jsonResponse(result.status, result.data);
    } catch (error) {
      return toGatewayErrorResponse(error);
    } finally {
      clearTmp();
    }
  };

  return middleware.handler(coreHandler);
}
