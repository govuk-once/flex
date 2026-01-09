import type { DeepPartial } from "@flex/utils";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { mergeDeepLeft } from "ramda";

// ----------------------------------------------------------------------------
// Event (HTTP API V2)
// ----------------------------------------------------------------------------

type EventOverrides = DeepPartial<APIGatewayProxyEventV2>;

type QueryParams = Record<
  string,
  string | number | boolean | Array<string | number | boolean>
>;

interface BaseRequestOptions {
  headers?: Record<string, string>;
  params?: QueryParams;
}

export type RequestOptions<TBody = never> = BaseRequestOptions &
  ([TBody] extends [never] ? { body?: never } : { body: TBody });

const baseEvent: APIGatewayProxyEventV2 = {
  version: "2.0",
  routeKey: "$default",
  rawPath: "/",
  rawQueryString: "",
  headers: {},
  requestContext: {
    accountId: "123456789012",
    apiId: "api-id",
    domainName: "api-id.execute-api.us-east-1.amazonaws.com",
    domainPrefix: "api-id",
    http: {
      method: "GET",
      path: "/",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "test-agent",
    },
    requestId: "request-id",
    routeKey: "$default",
    stage: "test",
    time: "01/Jan/2025:00:00:00 +0000",
    timeEpoch: 0,
  },
  isBase64Encoded: false,
};

function extractQueryParams(params: QueryParams = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) =>
    (Array.isArray(value) ? value : [value]).forEach((v) =>
      searchParams.append(key, String(v)),
    ),
  );

  return [searchParams.toString(), Object.fromEntries(searchParams)] as const;
}

function buildEvent(overrides: EventOverrides = {}) {
  return mergeDeepLeft(overrides, baseEvent) as APIGatewayProxyEventV2;
}

function buildEventRequest<T>(
  method: string,
  path: string,
  options: RequestOptions<T>,
) {
  const { body, headers, params } = options;

  const [rawPath = "/"] = path.split("?");
  const [rawQueryString, queryStringParameters] = extractQueryParams(params);

  return buildEvent({
    body: body ? JSON.stringify(body) : undefined,
    headers,
    rawPath,
    rawQueryString,
    requestContext: { http: { method, path: rawPath } },
    queryStringParameters,
  });
}

export function createEvent() {
  return {
    create: (overrides?: EventOverrides) => buildEvent(overrides),
    get: (path: string, options: RequestOptions = {}) =>
      buildEventRequest("GET", path, options),
    post: <T>(path: string, options: RequestOptions<T>) =>
      buildEventRequest("POST", path, options),
    put: <T>(path: string, options: RequestOptions<T>) =>
      buildEventRequest("PUT", path, options),
    patch: <T>(path: string, options: RequestOptions<T>) =>
      buildEventRequest("PATCH", path, options),
    delete: (path: string, options: RequestOptions = {}) =>
      buildEventRequest("DELETE", path, options),
  };
}

export const event = buildEvent();
