import type { DeepPartial } from "@flex/utils";
import type {
  APIGatewayAuthorizerResult,
  APIGatewayProxyEventV2,
  APIGatewayRequestAuthorizerEventV2,
} from "aws-lambda";
import { mergeDeepLeft } from "ramda";

// ----------------------------------------------------------------------------
// Shared
// ----------------------------------------------------------------------------

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

function extractQueryParams(params: QueryParams = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) =>
    (Array.isArray(value) ? value : [value]).forEach((v) =>
      searchParams.append(key, String(v)),
    ),
  );

  return [searchParams.toString(), Object.fromEntries(searchParams)] as const;
}

// ----------------------------------------------------------------------------
// Event (HTTP API V2)
// ----------------------------------------------------------------------------

type EventOverrides = DeepPartial<APIGatewayProxyEventV2>;

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
    time: "01/Jan/2026:00:00:00 +0000",
    timeEpoch: 0,
  },
  isBase64Encoded: false,
};

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
    requestContext: {
      http: { method, path: rawPath },
    },
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

// ----------------------------------------------------------------------------
// Authorizer Event (Lambda Authorizer V2)
// ----------------------------------------------------------------------------

type AuthorizerEventOverrides = DeepPartial<APIGatewayRequestAuthorizerEventV2>;

const baseAuthorizerEvent: APIGatewayRequestAuthorizerEventV2 = {
  version: "2.0",
  type: "REQUEST",
  routeArn:
    "arn:aws:execute-api:eu-west-2:123456789012:api-id/$default/GET/test",
  routeKey: "GET /test",
  rawPath: "/test",
  rawQueryString: "",
  identitySource: ["Bearer token123"],
  cookies: [],
  headers: {
    authorization: "Bearer token123",
    "content-type": "application/json",
  },
  queryStringParameters: undefined,
  pathParameters: undefined,
  stageVariables: undefined,
  requestContext: {
    accountId: "123456789012",
    apiId: "api-id",
    domainName: "api-id.execute-api.eu-west-2.amazonaws.com",
    domainPrefix: "api-id",
    http: {
      method: "GET",
      path: "/test",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "test-agent",
    },
    requestId: "test-request-id",
    routeKey: "GET /test",
    stage: "$default",
    time: "01/Jan/2026:00:00:00 +0000",
    timeEpoch: 0,
    authentication: undefined,
  },
};

function buildAuthorizerEvent(overrides: AuthorizerEventOverrides = {}) {
  return mergeDeepLeft(
    overrides,
    baseAuthorizerEvent,
  ) as APIGatewayRequestAuthorizerEventV2;
}

export function createAuthorizerEvent() {
  return {
    create: (overrides?: AuthorizerEventOverrides) =>
      buildAuthorizerEvent(overrides),
  };
}

export const authorizerEvent = buildAuthorizerEvent();

type AuthorizerResultOverrides = DeepPartial<APIGatewayAuthorizerResult>;

const baseAuthorizerAllowResult: APIGatewayAuthorizerResult = {
  principalId: "anonymous",
  policyDocument: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "execute-api:Invoke",
        Effect: "Allow",
        Resource: "*",
      },
    ],
  },
};

const baseAuthorizerDenyResult: APIGatewayAuthorizerResult = {
  principalId: "anonymous",
  policyDocument: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "execute-api:Invoke",
        Effect: "Deny",
        Resource: "*",
      },
    ],
  },
};

function buildAuthorizerResult(
  base: APIGatewayAuthorizerResult,
  overrides: AuthorizerResultOverrides = {},
) {
  return mergeDeepLeft(overrides, base) as APIGatewayAuthorizerResult;
}

export function createAuthorizerResult() {
  return {
    allow: (overrides?: AuthorizerResultOverrides) =>
      buildAuthorizerResult(baseAuthorizerAllowResult, overrides),
    deny: (overrides?: AuthorizerResultOverrides) =>
      buildAuthorizerResult(baseAuthorizerDenyResult, overrides),
  };
}

export const authorizerResult = {
  allow: buildAuthorizerResult(baseAuthorizerAllowResult),
  deny: buildAuthorizerResult(baseAuthorizerDenyResult),
};
