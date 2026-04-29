import type { Logger } from "@flex/logging";
import type { ZodType } from "zod";
import { ZodError } from "zod";

import type {
  DomainIntegrations,
  HeaderConfig,
  LambdaContext,
  LambdaEvent,
  RouteAuth,
} from "../types";
import {
  AuthorizationError,
  QueryParametersParseError,
  RequestBodyParseError,
} from "../utils/errors";
import { resolveHeaders } from "./headers";
import type { ResolvedResource } from "./resolve-config";
import type { RouteStore } from "./store";

export interface BuildContextOptions {
  gateway: "public" | "private";
  logger: Logger;
  bodySchema?: ZodType;
  querySchema?: ZodType;
  resources?: Readonly<Record<string, ResolvedResource>>;
  featureFlags?: Readonly<Record<string, boolean>>;
  headers?: Readonly<Record<string, HeaderConfig>>;
  integrations?: DomainIntegrations;
}

export function buildHandlerContext(
  event: LambdaEvent,
  context: LambdaContext,
  {
    gateway,
    logger,
    bodySchema,
    querySchema,
    resources: resourcesProp,
    featureFlags,
    headers,
    integrations,
  }: BuildContextOptions,
): RouteStore {
  const pathParams = extractPathParams(event.pathParameters);
  const body = extractRequestBody(event.body, bodySchema);
  const queryParams = extractQueryParams(
    event.queryStringParameters,
    querySchema,
  );
  const resources = resourcesProp
    ? extractResources(context, resourcesProp)
    : undefined;
  return {
    logger,
    ...(gateway === "public" && { auth: extractAuth(event.requestContext) }),
    ...(body !== undefined && { body }),
    ...(pathParams && { pathParams }),
    ...(queryParams && { queryParams }),
    ...(resources && { resources }),
    ...(featureFlags && { featureFlags }),
    ...(headers && { headers: resolveHeaders(headers, event.headers) }),
    ...(integrations && { integrations }),
  };
}

function extractAuth(requestContext: LambdaEvent["requestContext"]): RouteAuth {
  const { pairwiseId } = requestContext.authorizer;

  if (!pairwiseId) throw new AuthorizationError();

  return {
    pairwiseId,
  };
}

function extractPathParams(
  pathParameters: LambdaEvent["pathParameters"],
): Readonly<Record<string, string>> | undefined {
  if (!pathParameters || Object.keys(pathParameters).length === 0) {
    return;
  }

  return Object.fromEntries(
    Object.entries(pathParameters).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

function extractQueryParams(
  queryStringParameters: LambdaEvent["queryStringParameters"],
  schema?: ZodType,
) {
  if (!schema) return;

  try {
    return schema.parse(queryStringParameters ?? {}) as Readonly<
      Record<string, unknown>
    >;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new QueryParametersParseError(error);
    }

    throw error;
  }
}

function extractRequestBody(body: LambdaEvent["body"], schema?: ZodType) {
  if (!schema) return;

  try {
    return schema.parse(typeof body === "string" ? JSON.parse(body) : body);
  } catch {
    throw new RequestBodyParseError("Invalid request body");
  }
}

function extractResources(
  context: LambdaContext,
  resources: Readonly<Record<string, ResolvedResource>>,
) {
  return Object.fromEntries(
    Object.entries(resources).map(([key, { type, value }]) => {
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
