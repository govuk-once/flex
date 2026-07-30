import { logger } from "@flex/logging";
import { emitTelemetry, TelemetryEvent } from "@flex/telemetry";
import {
  HeaderValidationError,
  QueryParametersParseError,
  RequestBodyParseError,
} from "@flex/utils";
import createHttpError from "http-errors";

import type {
  DomainConfig,
  DomainResult,
  InferRouteContext,
  LambdaContext,
  LambdaEvent,
  LambdaResult,
  RouteHandler,
} from "../types";
import { cache } from "../utils/cache";
import { clearTmp } from "../utils/cleanup";
import { AuthorizationError } from "../utils/errors";
import { buildHandlerContext } from "./build-context";
import { mergeHeaders } from "./headers";
import { buildDomainIntegrations } from "./integrations";
import { configureMiddleware } from "./middleware";
import {
  getRouteConfig,
  getRouteFeatureFlags,
  getRouteIntegrations,
  getRouteLogLevel,
  getRouteResources,
} from "./resolve-config";
import { toApiGatewayResponse, validateHandlerResponse } from "./response";
import { extractRouteKeySegments } from "./route-key";
import { getRouteStore, routeStorage } from "./store";

export function createRouteHandler<const Config extends DomainConfig>(
  config: Config,
): RouteHandler<Config> {
  const cachedBuildDomainIntegrations = cache(() =>
    buildDomainIntegrations(config),
  );

  return (routeKey, handler) => {
    const routeKeySegments = extractRouteKeySegments(routeKey);

    const routeConfig = getRouteConfig(config, routeKeySegments);
    const logLevel = getRouteLogLevel(
      config.common?.logLevel,
      routeConfig.logLevel,
    );
    const resources = getRouteResources(
      config.resources,
      routeConfig.resources,
    );
    const headers = mergeHeaders(config.common?.headers, routeConfig.headers);

    const { gateway, method, version } = routeKeySegments;

    const verboseLogs = logLevel === "DEBUG" || logLevel === "TRACE";
    const hasRequestBody =
      method === "POST" || method === "PUT" || method === "PATCH";

    const bodySchema = hasRequestBody ? routeConfig.body : undefined;
    const querySchema = routeConfig.query;
    const responseSchema = routeConfig.response;

    logger.setLogLevel(logLevel);
    logger.setServiceName(
      `${config.name}-${gateway}-${version}-${routeConfig.name}`,
    );

    const middyHandler = configureMiddleware({
      logger,
      logLevel,
      hasRequestBody,
      resources,
    });

    const coreHandler = async (
      event: LambdaEvent,
      context: LambdaContext,
    ): Promise<LambdaResult> => {
      try {
        emitTelemetry(TelemetryEvent.domain_request_received, {
          method: event.httpMethod,
          path: event.path,
        });

        const integrations = routeConfig.integrations?.length
          ? getRouteIntegrations(
              cachedBuildDomainIntegrations(),
              routeConfig.integrations,
            )
          : undefined;

        const store = buildHandlerContext(event, context, {
          gateway,
          logger,
          bodySchema,
          querySchema,
          resources,
          featureFlags: getRouteFeatureFlags(
            config.featureFlags,
            routeConfig.featureFlags,
          ),
          headers,
          integrations,
        });

        return await routeStorage.run(store, async () => {
          const handlerResult = await handler(
            store as InferRouteContext<Config, typeof routeKey>,
          );

          const { errors, result } = validateHandlerResponse(
            handlerResult,
            responseSchema,
            { showErrors: verboseLogs },
          );

          if (errors) {
            logger.error("Response validation failed", {
              errors,
              ...(verboseLogs && { handlerResult }),
            });
            emitTelemetry(TelemetryEvent.response_validation_failed, {
              path: event.path,
            });
          }

          const response = toApiGatewayResponse(result);
          emitTelemetry(TelemetryEvent.domain_response_returned, {
            status: response.statusCode,
          });
          return response;
        });
      } catch (error) {
        const emitDomainError = (status: number) => {
          emitTelemetry(TelemetryEvent.domain_error_returned, {
            status,
            path: event.path,
          });
        };

        if (error instanceof HeaderValidationError) {
          const { headers, message, statusCode } = error;

          logger.warn("Missing required headers", { headers });
          emitTelemetry(TelemetryEvent.request_validation_failed, {
            part: "headers",
            path: event.path,
          });
          emitDomainError(statusCode);

          return {
            statusCode,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, headers }),
          };
        }

        if (error instanceof RequestBodyParseError) {
          const { message, statusCode } = error;

          logger.warn("Invalid request body", { message });
          emitTelemetry(TelemetryEvent.request_validation_failed, {
            part: "body",
            path: event.path,
          });
          emitDomainError(statusCode);

          return {
            statusCode,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
          };
        }

        if (error instanceof QueryParametersParseError) {
          const { message, statusCode, errors } = error;

          logger.warn("Invalid query parameters", { errors });
          emitTelemetry(TelemetryEvent.request_validation_failed, {
            part: "query",
            path: event.path,
          });
          emitDomainError(statusCode);

          return {
            statusCode,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, errors }),
          };
        }

        if (error instanceof AuthorizationError) {
          const { message, statusCode } = error;

          logger.error("Authorization failed", { detail: message });
          emitDomainError(statusCode);

          return {
            statusCode,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
          };
        }

        if (createHttpError.isHttpError(error)) {
          const { message, statusCode } = error;
          const level = statusCode >= 500 ? "error" : "warn";

          logger[level](message, { statusCode });
          emitDomainError(statusCode);

          return { statusCode, body: "" };
        }

        emitTelemetry(TelemetryEvent.error_thrown, {
          path: event.path,
          ...(error instanceof Error && { reason: error.message }),
        });
        emitDomainError(500);

        throw error;
      } finally {
        clearTmp();
      }
    };

    return middyHandler.handler(coreHandler);
  };
}

export function createRouteContext<const Config extends DomainConfig>(
  _: Config,
): DomainResult<Config>["routeContext"] {
  return (() => getRouteStore()) as DomainResult<Config>["routeContext"];
}
