import type { Logger } from "@flex/logging";
import type { ZodType } from "zod";

import type {
  DomainConfig,
  DomainResource,
  HeaderConfig,
  HttpMethod,
  LambdaContext,
  LambdaEvent,
  LogLevel,
  RouteAccess,
  RouteAuth,
} from "../types";
import { resolveHeaders } from "./headers";
import type { RouteStore } from "./store";

interface RouteConfigOptions {
  readonly version: string;
  readonly path: string;
  readonly method: HttpMethod;
  readonly gateway: "public" | "private";
}

interface ResolvedRouteConfig {
  readonly name: string;
  readonly access?: RouteAccess;
  readonly logLevel?: LogLevel;
  readonly query?: ZodType;
  readonly body?: ZodType;
  readonly response?: ZodType;
  readonly resources?: readonly string[];
  readonly integrations?: readonly string[];
  readonly headers?: Readonly<Record<string, HeaderConfig>>;
}

export function getRouteConfig(
  config: DomainConfig,
  { version, path, method, gateway }: RouteConfigOptions,
): ResolvedRouteConfig {
  const routeConfig = config.routes[version]?.[path]?.[method]?.[gateway];

  if (!routeConfig) {
    throw new Error(
      `Route config for "${method} /${version}${path}${gateway === "private" ? " [private]" : ""}" does not exist`,
    );
  }

  return routeConfig;
}

export function getRouteAccess(
  routeAccess?: RouteAccess,
  commonRouteAccess?: RouteAccess,
): RouteAccess {
  return routeAccess ?? commonRouteAccess ?? "isolated";
}

export interface ResolvedResource {
  type: DomainResource["type"];
  value: string;
}

/**
 * Resolves resource values from their source
 *
 * - `kms`, `ssm`: Values are known at deploy time and injected as env vars, which are read directly from process.env.
 * - `secret`, `ssm:deferred`: Values are fetched at runtime via Middy middleware and attached to the lambda context, so the env var refers to the resource name NOT the value
 */
export function getRouteResources(
  resources: DomainConfig["resources"],
  resourceKeys?: readonly string[],
): ReadonlyMap<string, ResolvedResource> | undefined {
  if (!resourceKeys?.length || !resources) return;

  return new Map(
    resourceKeys.map((key) => {
      const resource = resources[key];

      if (!resource) {
        throw new Error(
          `"${key}" referenced in "resources" but was not defined in domain resources`,
        );
      }

      const value = process.env[key];

      if (!value) {
        throw new Error(
          `Environment variable "${key}" not set. Has this resource been provisioned?`,
        );
      }

      return [key, { type: resource.type, value }] as const;
    }),
  );
}

function extractAuth(event: LambdaEvent): RouteAuth {
  const { pairwiseId } = event.requestContext.authorizer.lambda;

  if (!pairwiseId) throw new Error("Pairwise ID not found");

  return {
    pairwiseId,
  };
}

function extractPathParams(
  event: LambdaEvent,
): Readonly<Record<string, string>> | undefined {
  if (!event.pathParameters) return;

  return Object.fromEntries(
    Object.entries(event.pathParameters).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

function extractQueryParams(event: LambdaEvent, schema?: ZodType) {
  if (!schema) return;

  return schema.parse(event.queryStringParameters ?? {}) as Readonly<
    Record<string, unknown>
  >;
}

function extractRequestBody(event: LambdaEvent, schema?: ZodType) {
  if (!schema) return;

  return schema.parse(event.body);
}

function extractResources(
  context: LambdaContext,
  resources: ReadonlyMap<string, ResolvedResource>,
) {
  if (resources.size === 0) return;

  return Object.fromEntries(
    Array.from(resources).map(([key, { type, value }]) => {
      if (type === "kms" || type === "ssm") return [key, value];

      const contextValue = (context as unknown as Record<string, unknown>)[key];

      if (typeof contextValue !== "string") {
        throw new Error(
          `"${key}" (${type}) resource was not resolved by middleware`,
        );
      }

      return [key, contextValue];
    }),
  );
}

interface BuildContextOptions {
  access: RouteAccess;
  logger: Logger;
  bodySchema?: ZodType;
  querySchema?: ZodType;
  resources?: ReadonlyMap<string, ResolvedResource>;
  headers?: Readonly<Record<string, HeaderConfig>>;
  // TODO: integrations: unknown;
}

export function buildHandlerContext(
  event: LambdaEvent,
  context: LambdaContext,
  {
    access,
    logger,
    bodySchema,
    querySchema,
    resources,
    headers,
  }: BuildContextOptions,
): RouteStore {
  const pathParams = extractPathParams(event);
  const body = extractRequestBody(event, bodySchema);
  const queryParams = extractQueryParams(event, querySchema);

  return {
    logger,
    ...(access !== "public" && { auth: extractAuth(event) }),
    ...(body !== undefined && { body }),
    ...(pathParams && { pathParams }),
    ...(queryParams && { queryParams }),
    ...(resources && { resources: extractResources(context, resources) }),
    ...(headers && { headers: resolveHeaders(headers, event.headers) }),
    // TODO: ...(integrations && { integrations: null }),
  };
}
