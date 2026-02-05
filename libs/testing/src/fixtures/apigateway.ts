import type { DeepPartial, QueryParams } from "@flex/utils";
import { extractQueryParams } from "@flex/utils";
import type {
  APIGatewayAuthorizerResult,
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayRequestAuthorizerEventV2,
} from "aws-lambda";
import { mergeDeepLeft } from "ramda";

import { validJwt, validJwtUsername } from "./auth";

// ----------------------------------------------------------------------------
// Event (HTTP API V2)
// ----------------------------------------------------------------------------

export type EventOverrides = DeepPartial<APIGatewayProxyEventV2>;

export type EventRequestOptions<TBody = never> = {
  headers?: Record<string, string>;
  params?: QueryParams;
} & ([TBody] extends [never] ? { body?: never } : { body: TBody });

const baseEvent: APIGatewayProxyEventV2 = {
  version: "2.0",
  routeKey: "$default",
  rawPath: "/",
  rawQueryString: "",
  headers: {
    "Content-Type": "application/json",
  },
  requestContext: {
    accountId: "123456789012",
    apiId: "api-id",
    domainName: "api-id.execute-api.eu-west-2.amazonaws.com",
    domainPrefix: "api-id",
    http: {
      method: "GET",
      path: "/",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "test-agent",
    },
    requestId: "test-request-id",
    routeKey: "$default",
    stage: "$default",
    time: "01/Jan/2026:00:00:00 +0000",
    timeEpoch: 1735689600000,
  },
  isBase64Encoded: false,
};

function buildEvent(overrides: EventOverrides = {}) {
  return mergeDeepLeft(overrides, baseEvent) as APIGatewayProxyEventV2;
}

function buildEventRequest<T>(
  method: string,
  path: string,
  options: EventRequestOptions<T>,
) {
  const { body, headers, params } = options;

  const [rawPath = "/"] = path.split("?");
  const [rawQueryString, queryStringParameters] = extractQueryParams(params);
  const routeKey = `${method} ${rawPath}`;

  return buildEvent({
    body: body ? JSON.stringify(body) : undefined,
    headers,
    rawPath,
    rawQueryString,
    routeKey,
    requestContext: {
      http: { method, path: rawPath },
      routeKey,
    },
    queryStringParameters,
  });
}

export function createEvent() {
  return {
    create: (overrides?: EventOverrides) => buildEvent(overrides),
    get: (path: string, options: EventRequestOptions = {}) =>
      buildEventRequest("GET", path, options),
    post: <T>(path: string, options: EventRequestOptions<T>) =>
      buildEventRequest("POST", path, options),
    put: <T>(path: string, options: EventRequestOptions<T>) =>
      buildEventRequest("PUT", path, options),
    patch: <T>(path: string, options: EventRequestOptions<T>) =>
      buildEventRequest("PATCH", path, options),
    delete: (path: string, options: EventRequestOptions = {}) =>
      buildEventRequest("DELETE", path, options),
  } as const;
}

export const event = buildEvent();

// ----------------------------------------------------------------------------
// Event with Lambda Authorizer
// ----------------------------------------------------------------------------

export interface AuthorizerContext {
  pairwiseId?: string;
}

export type EventWithAuthorizer<
  T extends AuthorizerContext = AuthorizerContext,
> = APIGatewayProxyEventV2WithLambdaAuthorizer<T>;

export type EventWithAuthorizerOverrides<
  T extends AuthorizerContext = AuthorizerContext,
> = DeepPartial<EventWithAuthorizer<T>>;

const baseEventWithAuthorizer = buildEvent({
  requestContext: { authorizer: { lambda: {} } },
} as EventOverrides);

function buildEventWithAuthorizer<
  T extends AuthorizerContext = AuthorizerContext,
>(overrides: EventWithAuthorizerOverrides<T> = {}) {
  return mergeDeepLeft(
    overrides,
    baseEventWithAuthorizer,
  ) as EventWithAuthorizer<T>;
}

export function createEventWithAuthorizer<
  T extends AuthorizerContext = AuthorizerContext,
>() {
  return {
    create: (overrides?: EventWithAuthorizerOverrides<T>) =>
      buildEventWithAuthorizer<T>(overrides),
    authenticated: (
      overrides?: EventWithAuthorizerOverrides<T>,
      pairwiseId = "test-pairwise-id",
    ) =>
      buildEventWithAuthorizer({
        ...overrides,
        requestContext: { authorizer: { lambda: { pairwiseId } } },
      }),
    unauthenticated: (overrides?: EventWithAuthorizerOverrides<T>) =>
      buildEventWithAuthorizer({
        ...overrides,
        requestContext: { authorizer: { lambda: { pairwiseId: undefined } } },
      }),
  } as const;
}

export const eventWithAuthorizer = buildEventWithAuthorizer();

// ----------------------------------------------------------------------------
// Authorizer Event (Lambda Authorizer V2)
// ----------------------------------------------------------------------------

export type AuthorizerEventOverrides =
  DeepPartial<APIGatewayRequestAuthorizerEventV2>;

const baseAuthorizerEvent: APIGatewayRequestAuthorizerEventV2 = {
  version: "2.0",
  type: "REQUEST",
  routeArn:
    "arn:aws:execute-api:eu-west-2:123456789012:api-id/$default/GET/test",
  routeKey: "GET /test",
  rawPath: "/test",
  rawQueryString: "",
  identitySource: [`Bearer ${validJwt}`],
  cookies: [],
  headers: {
    authorization: `Bearer ${validJwt}`,
    "content-type": "application/json",
  },
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
    timeEpoch: 1735689600000,
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
    forRoute: (
      method: string,
      path: string,
      overrides?: AuthorizerEventOverrides,
    ) => {
      const [rawPath = "/"] = path.split("?");
      const routeKey = `${method} ${rawPath}`;

      return buildAuthorizerEvent({
        ...overrides,
        rawPath,
        routeArn: `arn:aws:execute-api:eu-west-2:123456789012:api-id/$default/${method}${rawPath}`,
        routeKey,
        requestContext: {
          ...overrides?.requestContext,
          http: { method, path: rawPath },
          routeKey,
        },
      });
    },
    withToken: (token: string, overrides?: AuthorizerEventOverrides) => {
      const bearerToken = `Bearer ${token}`;

      return buildAuthorizerEvent({
        ...overrides,
        identitySource: [bearerToken],
        headers: { ...overrides?.headers, authorization: bearerToken },
      });
    },
    missingToken: (overrides?: AuthorizerEventOverrides) =>
      buildAuthorizerEvent({
        ...overrides,
        identitySource: undefined,
        headers: { ...overrides?.headers, authorization: undefined },
      }),
  } as const;
}

export const authorizerEvent = buildAuthorizerEvent();

// ============================================================================
// Authorizer Result (Lambda Authorizer V2)
// ============================================================================

export type AuthorizerResultOverrides = DeepPartial<APIGatewayAuthorizerResult>;

export type AuthorizerResultContext = APIGatewayAuthorizerResult["context"];

const baseAuthorizerAllowResult: APIGatewayAuthorizerResult = {
  principalId: "anonymous",
  policyDocument: {
    Version: "2012-10-17",
    Statement: [
      { Action: "execute-api:Invoke", Effect: "Allow", Resource: "*" },
    ],
  },
};

const baseAuthorizerDenyResult: APIGatewayAuthorizerResult = {
  principalId: "anonymous",
  policyDocument: {
    Version: "2012-10-17",
    Statement: [
      { Action: "execute-api:Invoke", Effect: "Deny", Resource: "*" },
    ],
  },
};

function buildAuthorizerAllowResult(overrides: AuthorizerResultOverrides = {}) {
  return mergeDeepLeft(
    overrides,
    baseAuthorizerAllowResult,
  ) as APIGatewayAuthorizerResult;
}

function buildAuthorizerDenyResult(overrides: AuthorizerResultOverrides = {}) {
  return mergeDeepLeft(
    overrides,
    baseAuthorizerDenyResult,
  ) as APIGatewayAuthorizerResult;
}

export function createAuthorizerResult() {
  return {
    allow: (overrides?: AuthorizerResultOverrides) =>
      buildAuthorizerAllowResult(overrides),
    allowWithPairwiseId: (
      pairwiseId = validJwtUsername,
      overrides?: AuthorizerResultOverrides,
    ) =>
      buildAuthorizerAllowResult({
        ...overrides,
        context: { ...overrides?.context, pairwiseId },
      }),
    deny: (overrides?: AuthorizerResultOverrides) =>
      buildAuthorizerDenyResult(overrides),
  } as const;
}

export const authorizerResult = {
  allow: buildAuthorizerAllowResult(),
  deny: buildAuthorizerDenyResult(),
};

// ----------------------------------------------------------------------------
// Event (Rest API event)
// ----------------------------------------------------------------------------

export type RestApiEventOverrides = DeepPartial<APIGatewayProxyEvent>;

export type RestApiEventRequestOptions<TBody = never> = {
  headers?: Record<string, string>;
  params?: QueryParams;
} & ([TBody] extends [never] ? { body?: never } : { body: TBody });

const baseRestApiEvent: APIGatewayProxyEvent = {
  body: null,
  multiValueQueryStringParameters: {},
  pathParameters: {},
  queryStringParameters: {},
  stageVariables: {},
  resource: "/",
  path: "/",
  httpMethod: "GET",
  headers: {
    "Content-Type": "application/json",
  },
  multiValueHeaders: {},
  requestContext: {
    authorizer: undefined,
    protocol: "HTTP/1.1",
    httpMethod: "GET",
    path: "/",
    accountId: "123456789012",
    apiId: "api-id",
    domainName: "api-id.execute-api.eu-west-2.amazonaws.com",
    domainPrefix: "api-id",
    requestId: "test-request-id",
    routeKey: "$default",
    stage: "$default",
    identity: {
      accountId: "123456789012",
      apiKey: null,
      apiKeyId: null,
      accessKey: null,
      caller: "test-caller",
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: "127.0.0.1",
      user: null,
      userAgent: "test-agent",
      userArn: null,
    },
    requestTimeEpoch: 1735689600000,
    resourceId: "test-resource-id",
    resourcePath: "/",
    requestTime: "01/Jan/2026:00:00:00 +0000",
  },
  isBase64Encoded: false,
};

function buildRestApiEvent(overrides: RestApiEventOverrides = {}) {
  return mergeDeepLeft(overrides, baseRestApiEvent) as APIGatewayProxyEvent;
}

export function createRestApiEvent() {
  return {
    create: (overrides?: RestApiEventOverrides) => buildRestApiEvent(overrides),
    get: (path: string, options: RestApiEventRequestOptions = {}) =>
      buildRestApiEvent({
        ...options,
        httpMethod: "GET",
        path,
      }),
    post: <T>(path: string, options: RestApiEventRequestOptions<T>) =>
      buildRestApiEvent({
        ...options,
        httpMethod: "POST",
        path,
        body: options.body ? JSON.stringify(options.body) : undefined,
      }),
  } as const;
}

export const restApiEvent = buildRestApiEvent();
