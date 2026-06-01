import type { DeepPartial, QueryParams, UserId } from "@flex/utils";
import { extractQueryParams } from "@flex/utils";
import type {
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Context,
} from "aws-lambda";

import { createFixtureBuilder, createFixtureFactory } from "../utils/factory";
import { createUserId } from "./user";

// ----------------------------------------------------------------------------
// Event
// ----------------------------------------------------------------------------

export type SdkEvent = APIGatewayProxyWithLambdaAuthorizerEvent<{
  pairwiseId: string;
}>;

interface SdkEventRequestOptions {
  headers?: Record<string, string>;
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
      /** TODO:
       * - Existing event uses "test-pairwise-id"
       * - Existing context uses "test-user-id" (later addition, default set by createUserId)
       *
       * Was this intentional or should they match moving forward?
       */
      principalId: "test-pairwise-id",
      integrationLatency: 0,
      pairwiseId: "test-pairwise-id",
    },
    // NOSONAR temporary until fixtures/apigateway.ts mocks have been removed
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

function toRequest(
  httpMethod: string,
  path: string,
  { body, headers, query }: SdkEventOverrides = {},
): DeepPartial<SdkEvent> {
  return {
    httpMethod,
    path,
    headers: { "Content-Type": "application/json", ...headers },
    queryStringParameters: extractQueryParams(query)[1],
    ...(body !== undefined && { body: JSON.stringify(body) }),
  };
}

type SdkEventOptions<Body = never> = SdkEventRequestOptions &
  ([Body] extends [never] ? { body?: never } : { body: Body });

export function createSdkEvent() {
  return createFixtureFactory(baseSdkEvent, (build) => ({
    get: (path: string, options?: SdkEventOptions) =>
      build(toRequest("GET", path, options)),
    post: <Body>(path: string, options: SdkEventOptions<Body>) =>
      build(toRequest("POST", path, options)),
    put: <Body>(path: string, options: SdkEventOptions<Body>) =>
      build(toRequest("PUT", path, options)),
    patch: <Body>(path: string, options: SdkEventOptions<Body>) =>
      build(toRequest("PATCH", path, options)),
    delete: (path: string, options?: SdkEventOptions) =>
      build(toRequest("DELETE", path, options)),
  }));
}

export type SdkEventFactory = ReturnType<typeof createSdkEvent>;

// ----------------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------------

export const baseSdkContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "test-function",
  functionVersion: "$LATEST",
  invokedFunctionArn:
    "arn:aws:lambda:eu-west-2:123456789012:function:test-function",
  memoryLimitInMB: "128",
  awsRequestId: "test-request-id",
  logGroupName: "/aws/lambda/test-function",
  logStreamName: "2026/01/01/[$LATEST]test-request-id",
  getRemainingTimeInMillis: () => 30_000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

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
    ...createFixtureBuilder(baseSdkContext)(overrides),
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
