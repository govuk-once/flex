import type { Logger } from "@flex/logging";
import type { ZodType } from "zod";

import type {
  DomainIntegrations,
  HeaderConfig,
  LambdaContext,
  LambdaEvent,
  RouteAccess,
  RouteAuth,
} from "../types";
import { RequestBodyParseError } from "../utils/errors";
import { resolveHeaders } from "./headers";
import type { ResolvedResource } from "./resolve-config";
import type { RouteStore } from "./store";

interface BuildContextOptions {
  access: RouteAccess;
  logger: Logger;
  bodySchema?: ZodType;
  querySchema?: ZodType;
  resources?: ReadonlyMap<string, ResolvedResource>;
  headers?: Readonly<Record<string, HeaderConfig>>;
  integrations?: DomainIntegrations;
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
    integrations,
  }: BuildContextOptions,
): RouteStore {
  const pathParams = extractPathParams(event);
  const body = extractRequestBody(event.body, bodySchema);
  const queryParams = extractQueryParams(event, querySchema);

  return {
    logger,
    ...(access !== "public" && { auth: extractAuth(event) }),
    ...(body !== undefined && { body }),
    ...(pathParams && { pathParams }),
    ...(queryParams && { queryParams }),
    ...(resources && { resources: extractResources(context, resources) }),
    ...(headers && { headers: resolveHeaders(headers, event.headers) }),
    ...(integrations && { integrations }),
  };
}

function extractAuth(event: LambdaEvent): RouteAuth {
  const { pairwiseId } = event.requestContext.authorizer;

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
