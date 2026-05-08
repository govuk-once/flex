import type { ApiResult, FlexFetchRequestInit } from "@flex/flex-fetch";
import { createSigv4Fetcher, flexFetch, typedFetch } from "@flex/flex-fetch";
import { type ZodType } from "zod";

import type {
  DomainConfig,
  DomainIntegration,
  DomainIntegrations,
  HttpMethod,
  IntegrationResult,
} from "../types";
import { AuthorizationError } from "../utils/errors";
import { extractRouteKeySegments } from "./route-key";
import { routeStorage } from "./store";

interface ParsedIntegrationRoute extends ReturnType<
  typeof extractRouteKeySegments
> {
  readonly isWildcard: boolean;
}

export function parseIntegrationRoute(
  routeKey: string,
): ParsedIntegrationRoute {
  const isWildcard = routeKey.endsWith("/*");

  const segments = extractRouteKeySegments(
    isWildcard ? routeKey.replace(/\*$/, "") : routeKey,
  );

  return {
    ...segments,
    ...(isWildcard && { path: segments.path.replace(/\/$/, "") }),
    isWildcard,
  };
}

// TODO: Is this needed? Identical shapes for now but will keep it incase either shape changes
export function toIntegrationResult<T>(
  result: ApiResult<T>,
): IntegrationResult<T> {
  if (result.ok) return { ok: true, status: result.status, data: result.data };

  const { message, status, body } = result.error;

  return { ok: false, error: { status, message, body } };
}

// ----------------------------------------------------------------------------
// Integration / Request
// ----------------------------------------------------------------------------

export interface InvokerOptions extends Pick<
  FlexFetchRequestInit,
  "maxRetryDelay" | "retryAttempts"
> {
  path?: string;
  body?: unknown;
  headers?: Readonly<Record<string, string>>;
  query?: Readonly<Record<string, string>>;
}

export interface IntegrationInvokerConfig extends Pick<
  FlexFetchRequestInit,
  "maxRetryDelay" | "retryAttempts"
> {
  readonly method: HttpMethod;
  readonly basePath: string;
  readonly path: string;
  readonly isWildcard: boolean;
  readonly schema?: ZodType;
}

function buildFetcherUrl(
  {
    basePath,
    isWildcard,
    path,
  }: Pick<IntegrationInvokerConfig, "basePath" | "isWildcard" | "path">,
  options?: InvokerOptions,
) {
  const pathname = `${basePath}${path}${isWildcard ? (options?.path ?? "") : ""}`;

  if (!options?.query || Object.keys(options.query).length === 0) {
    return pathname;
  }

  return `${pathname}?${new URLSearchParams(options.query)}`;
}

function buildFetcherOptions(
  method: HttpMethod,
  integration: Pick<
    IntegrationInvokerConfig,
    "maxRetryDelay" | "retryAttempts"
  >,
  invokerOptions?: InvokerOptions,
): FlexFetchRequestInit {
  const headers = {
    ...invokerOptions?.headers,
  };

  const hasBody = invokerOptions?.body !== undefined;

  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  return {
    method,
    retryAttempts: invokerOptions?.retryAttempts ?? integration.retryAttempts,
    maxRetryDelay: invokerOptions?.maxRetryDelay ?? integration.maxRetryDelay,
    ...(Object.keys(headers).length > 0 && { headers }),
    ...(hasBody && { body: JSON.stringify(invokerOptions.body) }),
  };
}

type IntegrationFetcher = (
  path: string,
  options?: FlexFetchRequestInit,
) => { request: Promise<Response>; abort: () => void };

export function createIntegrationInvoker(
  fetcher: IntegrationFetcher,
  integration: IntegrationInvokerConfig,
): (...args: never[]) => Promise<IntegrationResult> {
  return async (options?: InvokerOptions): Promise<IntegrationResult> => {
    const { request } = fetcher(
      buildFetcherUrl(integration, options),
      buildFetcherOptions(integration.method, integration, options),
    );

    const resultPromise = await typedFetch(request, integration.schema);

    return toIntegrationResult(resultPromise);
  };
}

interface IntegrationBasePathConfig {
  target: string;
  type: DomainIntegration["type"];
  version: string;
}

function createIntegrationBasePath({
  target,
  type,
  version,
}: IntegrationBasePathConfig) {
  switch (type) {
    case "domain":
      return `/domains/${target}/${version}`;
    case "gateway":
      return `/gateways/${target}/${version}`;
    case "public":
      return `/app/${target}/${version}`;
  }
}

function resolveGatewayUrl(
  resources: DomainConfig["resources"],
  gatewayPath: string,
) {
  if (!resources || Object.keys(resources).length === 0) {
    throw new Error(
      "Domain resources must define a gateway URL when integrations are used",
    );
  }

  const entry = Object.entries(resources).find(
    ([, { path }]) => path === gatewayPath,
  );

  if (!entry) {
    throw new Error(`"${gatewayPath}" resource was not found`);
  }

  const [key] = entry;
  const value = process.env[key];

  if (!value) {
    throw new Error(
      `Environment variable "${key}" for gateway URL does not exist`,
    );
  }

  return value;
}

interface CreateBearerFetcherOptions {
  baseUrl: string;
  getToken: () => string | undefined;
}

export function createBearerFetcher({
  baseUrl,
  getToken,
}: CreateBearerFetcherOptions): IntegrationFetcher {
  return (path, options) => {
    const token = getToken();
    if (!token) {
      throw new AuthorizationError(
        "Public integration invoked without an inbound JWT to forward",
      );
    }
    const callerHeaders = (options?.headers ?? {}) as Record<string, string>;
    const headers: Record<string, string> = {
      ...callerHeaders,
      Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
    };
    return flexFetch(`${baseUrl}${path}`, { ...options, headers });
  };
}

// ----------------------------------------------------------------------------
// Integration / Builder
// ----------------------------------------------------------------------------

const PRIVATE_GATEWAY_URL_PATH = "/flex/apigw/private/gateway-url";
const PUBLIC_API_URL_PATH = "/flex/apigw/public/url";

export function buildDomainIntegrations(
  config: DomainConfig,
): DomainIntegrations | undefined {
  if (!config.integrations || Object.keys(config.integrations).length === 0) {
    return;
  }

  const region = process.env.AWS_REGION;

  if (!region) {
    throw new Error("AWS region is required when an integration is defined");
  }

  const integrationEntries = Object.entries(config.integrations);
  const usesPrivate = integrationEntries.some(
    ([, integration]) =>
      integration.type === "domain" || integration.type === "gateway",
  );
  const usesPublic = integrationEntries.some(
    ([, integration]) => integration.type === "public",
  );

  const sigv4Fetcher = usesPrivate
    ? createSigv4Fetcher({
        baseUrl: resolveGatewayUrl(config.resources, PRIVATE_GATEWAY_URL_PATH),
        region,
      })
    : undefined;

  const bearerFetcher = usesPublic
    ? createBearerFetcher({
        baseUrl: resolveGatewayUrl(config.resources, PUBLIC_API_URL_PATH),
        getToken: () => routeStorage.getStore()?.auth?.bearerToken,
      })
    : undefined;

  return Object.fromEntries(
    integrationEntries.map(([key, integration]) => {
      const route = parseIntegrationRoute(integration.route);
      const basePath = createIntegrationBasePath({
        target: integration.target ?? config.name,
        type: integration.type,
        version: route.version,
      });

      const fetcher =
        integration.type === "public" ? bearerFetcher : sigv4Fetcher;

      if (!fetcher) {
        throw new Error(
          `No fetcher available for integration "${key}" of type "${integration.type}"`,
        );
      }

      return [
        key,
        createIntegrationInvoker(fetcher, {
          method: route.method,
          basePath,
          path: route.path,
          isWildcard: route.isWildcard,
          schema: integration.response,
          retryAttempts: integration.retryAttempts,
          maxRetryDelay: integration.maxRetryDelay,
        }),
      ];
    }),
  );
}
