import { logger } from "@flex/logging";
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
import { HeaderValidationError, RequestBodyParseError } from "../utils/errors";
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
    const featureFlags = getRouteFeatureFlags(
      config.featureFlags,
      routeConfig.featureFlags,
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
        const integrations = getRouteIntegrations(
          cachedBuildDomainIntegrations(),
          routeConfig.integrations,
        );

        const store = buildHandlerContext(event, context, {
          gateway,
          logger,
          bodySchema,
          querySchema,
          resources,
          featureFlags,
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
          }

          return toApiGatewayResponse(result);
        });
      } catch (error) {
        if (error instanceof HeaderValidationError) {
          const { headers, message, statusCode } = error;

          logger.warn("Missing required headers", { headers });

          return {
            statusCode,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, headers }),
          };
        }

        if (error instanceof RequestBodyParseError) {
          const { message, statusCode } = error;

          logger.warn("Invalid request body", { message });

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

          return { statusCode, body: "" };
        }

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
