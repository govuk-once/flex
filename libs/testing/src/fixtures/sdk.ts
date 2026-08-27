import type { DeepPartial, QueryParams, UserId } from "@flex/utils";
import { extractQueryParams } from "@flex/utils";
import type {
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Context,
} from "aws-lambda";

import { createFixtureVariants } from "../utils/fixtures";
import { buildLambdaContext } from "./lambda";
import { createUserId } from "./user";

// ----------------------------------------------------------------------------
// Event
// ----------------------------------------------------------------------------

export type SdkEvent = APIGatewayProxyWithLambdaAuthorizerEvent<{
  pairwiseId: string;
}>;

interface SdkEventRequestOptions {
  auth?: UserId | false;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  query?: QueryParams;
}

export const baseSdkEvent: SdkEvent = {
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
    authorizer: {
      principalId: "test-user-id",
      integrationLatency: 0,
      pairwiseId: "test-user-id",
    },
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

type SdkEventOverrides = SdkEventRequestOptions & { body?: unknown };

function toAuthorizer(auth: UserId | false) {
  return auth === false
    ? { integrationLatency: 0, pairwiseId: "", principalId: "" }
    : { integrationLatency: 0, pairwiseId: auth, principalId: auth };
}

function toRequest(
  httpMethod: string,
  path: string,
  { auth, body, headers, params, query }: SdkEventOverrides = {},
): DeepPartial<SdkEvent> {
  return {
    httpMethod,
    path,
    headers: { "Content-Type": "application/json", ...headers },
    queryStringParameters: extractQueryParams(query)[1],
    ...(params && { pathParameters: params }),
    ...(auth !== undefined && {
      requestContext: { authorizer: toAuthorizer(auth) },
    }),
    ...(body !== undefined && { body: JSON.stringify(body) }),
  };
}

type SdkEventOptions<Body = never> = SdkEventRequestOptions &
  ([Body] extends [never] ? { body?: never } : { body: Body });

export function createSdkEvent() {
  return createFixtureVariants(baseSdkEvent, (build) => ({
    get: (path: string, options?: SdkEventOptions) =>
      build(toRequest("GET", path, options)),
    post: <Body = never>(path: string, options?: SdkEventOptions<Body>) =>
      build(toRequest("POST", path, options)),
    put: <Body = never>(path: string, options?: SdkEventOptions<Body>) =>
      build(toRequest("PUT", path, options)),
    patch: <Body = never>(path: string, options?: SdkEventOptions<Body>) =>
      build(toRequest("PATCH", path, options)),
    delete: (path: string, options?: SdkEventOptions) =>
      build(toRequest("DELETE", path, options)),
  }));
}

export type SdkEventFactory = ReturnType<typeof createSdkEvent>;

// ----------------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------------

export type SdkContext = Context & { userId: UserId };

interface SdkContextOptions {
  overrides?: DeepPartial<Context>;
  params?: Record<string, unknown>;
  secrets?: Record<string, unknown>;
  userId?: UserId;
}

export function createSdkContext() {
  return ({
    overrides,
    params,
    secrets,
    userId = createUserId(),
  }: SdkContextOptions = {}): SdkContext => ({
    ...buildLambdaContext(overrides),
    ...params,
    ...secrets,
    userId,
  });
}

export type SdkContextFactory = ReturnType<typeof createSdkContext>;

export interface SdkFixture {
  event: SdkEventFactory;
  context: SdkContextFactory;
}
