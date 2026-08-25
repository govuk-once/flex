import type { DeepPartial, HttpMethod, QueryParams } from "@flex/utils";
import { extractQueryParams } from "@flex/utils";
import type {
  APIGatewayAuthorizerResult,
  APIGatewayProxyEvent,
  APIGatewayProxyStructuredResultV2,
  APIGatewayTokenAuthorizerEvent,
  CloudFrontFunctionsCookies,
  CloudFrontFunctionsEvent,
  CloudFrontFunctionsHeaders,
  CloudFrontFunctionsQuerystring,
  StatementEffect,
} from "aws-lambda";

import { createFixtureBuilder, createFixtureVariants } from "../utils/fixtures";
import { validJwt } from "./auth";
import type { DynamoFixture } from "./dynamo";
import type { LambdaContextFactory } from "./lambda";
import type { SecretFixture } from "./secret";

// ----------------------------------------------------------------------------
// Gateway Event
// ----------------------------------------------------------------------------

export type PlatformGatewayEvent = APIGatewayProxyEvent;

const baseGatewayEvent: PlatformGatewayEvent = {
  body: null,
  headers: {},
  multiValueHeaders: {},
  httpMethod: "GET",
  isBase64Encoded: false,
  path: "/",
  pathParameters: {},
  queryStringParameters: {},
  multiValueQueryStringParameters: {},
  stageVariables: {},
  requestContext: {
    accountId: "123456789012",
    apiId: "api-id",
    authorizer: null,
    protocol: "HTTP/1.1",
    httpMethod: "GET",
    identity: {
      accessKey: null,
      accountId: "123456789012",
      apiKey: null,
      apiKeyId: null,
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
    path: "/",
    stage: "$default",
    requestId: "test-request-id",
    requestTimeEpoch: 1735689600000,
    resourceId: "test-resource-id",
    resourcePath: "/",
  },
  resource: "/",
};

interface GatewayEventRequestOptions {
  headers?: Record<string, string>;
  query?: QueryParams;
}

type GatewayEventOverrides = GatewayEventRequestOptions & { body?: unknown };

function resolveGatewayPathPrefix() {
  const name = process.env.FLEX_GATEWAY_NAME;

  if (!name) {
    throw new Error(`Missing "FLEX_GATEWAY_NAME". Set in the Vitest config.`);
  }

  return `/gateways/${name}`;
}

function toGatewayRequest(
  httpMethod: HttpMethod,
  path: string,
  { body, headers, query }: GatewayEventOverrides = {},
): DeepPartial<PlatformGatewayEvent> {
  const gatewayPath = `${resolveGatewayPathPrefix()}${path}`;

  return {
    httpMethod,
    path: gatewayPath,
    queryStringParameters: extractQueryParams(query)[1],
    headers: headers ?? {},
    requestContext: { httpMethod, path: gatewayPath },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  };
}

type GatewayEventOptions<Body = never> = GatewayEventRequestOptions &
  ([Body] extends [never] ? { body?: never } : { body: Body });

export function createPlatformGatewayEvent() {
  return createFixtureVariants(baseGatewayEvent, (build) => ({
    get: (path: string, options?: GatewayEventOptions) =>
      build(toGatewayRequest("GET", path, options)),
    post: <Body = never>(path: string, options?: GatewayEventOptions<Body>) =>
      build(toGatewayRequest("POST", path, options)),
    put: <Body = never>(path: string, options?: GatewayEventOptions<Body>) =>
      build(toGatewayRequest("PUT", path, options)),
    patch: <Body = never>(path: string, options?: GatewayEventOptions<Body>) =>
      build(toGatewayRequest("PATCH", path, options)),
    delete: (path: string, options?: GatewayEventOptions) =>
      build(toGatewayRequest("DELETE", path, options)),
  }));
}

type PlatformGatewayEventFactory = ReturnType<
  typeof createPlatformGatewayEvent
>;

// ----------------------------------------------------------------------------
// Gateway Result
// ----------------------------------------------------------------------------

// TODO: Review the `jsonResponse` return type and confirm if its correct or if `APIGatewayProxyResult` should be used instead
export type PlatformGatewayResult = APIGatewayProxyStructuredResultV2;

const baseGatewayResult: PlatformGatewayResult = {
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: undefined,
};

const gatewayResultBuilder = createFixtureBuilder(baseGatewayResult);

interface GatewayResultOptions extends Omit<
  Partial<PlatformGatewayResult>,
  "body" | "statusCode"
> {
  body?: unknown;
}

export function buildPlatformGatewayResult(
  statusCode: number,
  { body, headers, ...overrides }: GatewayResultOptions = {},
) {
  return gatewayResultBuilder({
    statusCode,
    headers: { ...headers },
    ...(body !== undefined && { body: JSON.stringify(body) }),
    ...overrides,
  });
}

type PlatformGatewayResultFactory = typeof buildPlatformGatewayResult;

// ----------------------------------------------------------------------------
// Authorizer Event
// ----------------------------------------------------------------------------

export type PlatformAuthorizerEvent = APIGatewayTokenAuthorizerEvent;

const baseAuthorizerEvent: PlatformAuthorizerEvent = {
  type: "TOKEN",
  authorizationToken: `Bearer ${validJwt}`,
  methodArn:
    "arn:aws:execute-api:eu-west-2:123456789012:api-id/$default/GET/v1/example",
};

export const buildPlatformAuthorizerEvent =
  createFixtureBuilder(baseAuthorizerEvent);

type PlatformAuthorizerEventFactory = typeof buildPlatformAuthorizerEvent;

// ----------------------------------------------------------------------------
// Authorizer Result
// ----------------------------------------------------------------------------

export type PlatformAuthorizerResult = APIGatewayAuthorizerResult;

const baseAuthorizerResult: PlatformAuthorizerResult = {
  principalId: "anonymous",
  policyDocument: { Version: "2012-10-17", Statement: [] },
  context: undefined,
};

const authorizerResultBuilder = createFixtureBuilder(baseAuthorizerResult);

type AuthorizerResultOptions = Omit<
  DeepPartial<PlatformAuthorizerResult>,
  "policyDocument"
>;

export function buildPlatformAuthorizerResult(
  effect: StatementEffect,
  resource: string | string[],
  options: AuthorizerResultOptions = {},
) {
  return authorizerResultBuilder({
    policyDocument: {
      Statement: [
        { Action: "execute-api:Invoke", Effect: effect, Resource: resource },
      ],
    },
    ...options,
  });
}

type PlatformAuthorizerResultFactory = typeof buildPlatformAuthorizerResult;

// ----------------------------------------------------------------------------
// CloudFront Function Event
// ----------------------------------------------------------------------------

export type PlatformCloudFrontEvent = CloudFrontFunctionsEvent;

const baseCloudFrontEvent: PlatformCloudFrontEvent = {
  version: "1.0",
  context: {
    distributionDomainName: "d1234567890.cloudfront.net",
    distributionId: "EDFDVBD6EXAMPLE",
    eventType: "viewer-request",
    requestId: "test-request-id",
  },
  viewer: {
    ip: "192.0.2.1",
  },
  request: {
    method: "GET",
    uri: "/example",
    querystring: {},
    headers: {},
    cookies: {},
  },
  response: { statusCode: 200, headers: {}, cookies: {} },
};

type CloudFrontValues<T> = Record<string, string | T>;

interface CloudFrontEventOptions {
  cookies?: CloudFrontValues<CloudFrontFunctionsCookies[string]>;
  headers?: CloudFrontValues<CloudFrontFunctionsHeaders[string]>;
  query?: CloudFrontValues<CloudFrontFunctionsQuerystring[string]>;
}

const toCloudFrontValues = <T>(values: CloudFrontValues<T> = {}) =>
  Object.fromEntries(
    Object.entries(values).map(([k, v]) => [
      k.toLowerCase(),
      typeof v === "string" ? { value: v } : v,
    ]),
  );

function toCloudFrontRequest(
  method: HttpMethod,
  uri: string,
  { cookies, headers, query }: CloudFrontEventOptions = {},
): DeepPartial<PlatformCloudFrontEvent> {
  return {
    request: {
      method,
      uri,
      cookies: toCloudFrontValues(cookies),
      headers: toCloudFrontValues(headers),
      querystring: toCloudFrontValues(query),
    },
  };
}

export function createPlatformCloudFrontEvent() {
  return createFixtureVariants(baseCloudFrontEvent, (build) => ({
    get: (uri: string, options?: CloudFrontEventOptions) =>
      build(toCloudFrontRequest("GET", uri, options)),
    post: (uri: string, options?: CloudFrontEventOptions) =>
      build(toCloudFrontRequest("POST", uri, options)),
    put: (uri: string, options?: CloudFrontEventOptions) =>
      build(toCloudFrontRequest("PUT", uri, options)),
    patch: (uri: string, options?: CloudFrontEventOptions) =>
      build(toCloudFrontRequest("PATCH", uri, options)),
    delete: (uri: string, options?: CloudFrontEventOptions) =>
      build(toCloudFrontRequest("DELETE", uri, options)),
  }));
}

type PlatformCloudFrontEventFactory = ReturnType<
  typeof createPlatformCloudFrontEvent
>;

// ----------------------------------------------------------------------------
// CloudFront Function Result
// ----------------------------------------------------------------------------

type CloudFrontBodyEncoding = "base64" | "text";

export interface PlatformCloudFrontResult extends Partial<
  Omit<CloudFrontFunctionsEvent["response"], "statusCode">
> {
  statusCode: number;
  body?: { encoding: CloudFrontBodyEncoding; data: string };
}

const baseCloudFrontResult: PlatformCloudFrontResult = {
  statusCode: 200,
  headers: {},
};

const cloudFrontResultBuilder = createFixtureBuilder(baseCloudFrontResult);

interface CloudFrontResultOptions {
  body?: unknown;
  cookies?: CloudFrontValues<CloudFrontFunctionsCookies[string]>;
  encoding?: CloudFrontBodyEncoding;
  headers?: CloudFrontValues<CloudFrontFunctionsHeaders[string]>;
  statusDescription?: string;
}

export function buildPlatformCloudFrontResult(
  statusCode: number,
  {
    body,
    cookies,
    encoding = "text",
    headers,
    statusDescription,
  }: CloudFrontResultOptions = {},
) {
  return cloudFrontResultBuilder({
    statusCode,
    headers: toCloudFrontValues(headers),
    ...(statusDescription !== undefined && { statusDescription }),
    ...(cookies && { cookies: toCloudFrontValues(cookies) }),
    ...(body !== undefined && {
      body: {
        encoding,
        data: typeof body === "string" ? body : JSON.stringify(body),
      },
    }),
  });
}

type PlatformCloudFrontResultFactory = typeof buildPlatformCloudFrontResult;

export interface PlatformFixture {
  gatewayEvent: PlatformGatewayEventFactory;
  gatewayResult: PlatformGatewayResultFactory;
  authorizerEvent: PlatformAuthorizerEventFactory;
  authorizerResult: PlatformAuthorizerResultFactory;
  cloudFrontEvent: PlatformCloudFrontEventFactory;
  cloudFrontResult: PlatformCloudFrontResultFactory;
  context: LambdaContextFactory;
  /** Stubs the DynamoDB reads a gateway's clients make. */
  dynamo: DynamoFixture;
  /** Stubs the Secrets Manager reads a gateway's resources make. */
  secret: SecretFixture;
}
