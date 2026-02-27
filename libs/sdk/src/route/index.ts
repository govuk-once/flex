import { getLogger } from "@flex/logging";

import type {
  DomainConfig,
  DomainResult,
  HttpMethod,
  InferRouteContext,
  LambdaContext,
  LambdaEvent,
  LambdaResult,
  RouteHandler,
} from "../types";
import {
  buildHandlerContext,
  getRouteAccess,
  getRouteConfig,
  getRouteResources,
} from "./context";
import { HeaderValidationError, mergeHeaders } from "./headers";
import { configureMiddleware } from "./middleware";
import { toApiGatewayResponse, validateHandlerResponse } from "./response";
import { getRouteStore, routeStorage } from "./store";

interface RouteKeySegments {
  method: HttpMethod;
  version: string;
  path: string;
  gateway: "public" | "private";
}

export function extractRouteKeySegments(routeKey: string) {
  const [method, versionedPath = ""] = routeKey.split(" ");

  if (!method || !versionedPath) {
    throw new Error(
      `Invalid route key. Expected "METHOD /version/path", got "${routeKey}"`,
    );
  }

  const [, version, ...pathParts] = versionedPath.split("/");

  return {
    method: method,
    version: version,
    path: `/${pathParts.join("/")}`,
    gateway: routeKey.endsWith("[private]") ? "private" : "public",
  } as RouteKeySegments;
}

export function stripRouteKeyGatewayIdentifier(route: string) {
  return route.replace(/\s+\[private\]$/, "");
}

export function createRouteHandler<const Config extends DomainConfig>(
  config: Config,
): RouteHandler<Config> {
  return (routeKey, handler) => {
    const routeKeySegments = extractRouteKeySegments(routeKey);

    const routeConfig = getRouteConfig(config, routeKeySegments);
    const routeAccess = getRouteAccess(
      routeConfig.access,
      config.common?.access,
    );
    const resources = getRouteResources(
      config.resources,
      routeConfig.resources,
    );
    const headers = mergeHeaders(config.common?.headers, routeConfig.headers);

    const { gateway, method, version } = routeKeySegments;

    const logLevel = routeConfig.logLevel ?? config.common?.logLevel ?? "INFO";
    const hasRequestBody =
      method === "POST" || method === "PUT" || method === "PATCH";

    const bodySchema = hasRequestBody ? routeConfig.body : undefined;
    const querySchema = routeConfig.query;
    const responseSchema = routeConfig.response;

    const logger = getLogger({
      serviceName: `${config.name}-${gateway}-${version}-${routeConfig.name}`,
      logLevel,
    });

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
        const store = buildHandlerContext(event, context, {
          access: routeAccess,
          logger,
          bodySchema,
          querySchema,
          resources,
          headers,
        });

        return await routeStorage.run(store, async () => {
          const handlerResult = await handler(
            store as InferRouteContext<Config, typeof routeKey>,
          );

          const { errors, result } = validateHandlerResponse(
            handlerResult,
            responseSchema,
            { showErrors: logLevel === "DEBUG" || logLevel === "TRACE" },
          );

          if (errors) {
            logger.error("Response validation failed", {
              errors,
              handlerResult,
            });
          }

          return toApiGatewayResponse(result);
        });
      } catch (error) {
        if (error instanceof HeaderValidationError) {
          logger.warn("Missing required headers", { headers: error.headers });

          return {
            statusCode: error.statusCode,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: error.message,
              headers: error.headers,
            }),
          };
        }

        throw error;
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
