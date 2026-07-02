// TODO: (ticket) Replicate SDK fixtures in @flex/testing for service gateway

import { mergeFixture } from "@flex/testing";
import type { DeepPartial } from "@flex/utils";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";

import type { GatewayConfig } from "../types";
import type { MatchedRoute } from "../utils/routes";

export const routeKey = "GET /v1/path";

export const createGatewayConfig = (
  overrides: DeepPartial<GatewayConfig> = {},
) =>
  mergeFixture<GatewayConfig>(
    {
      name: "example",
      environments: [],
      access: "private",
      resources: {},
      policy: {},
      routes: { [routeKey]: { name: "example" } },
    },
    overrides,
  );
export const gatewayConfig = createGatewayConfig();

export const createGatewayEvent = (
  overrides: DeepPartial<APIGatewayProxyEvent> = {},
) =>
  mergeFixture<APIGatewayProxyEvent>(
    {
      body: null,
      multiValueQueryStringParameters: {},
      pathParameters: {},
      queryStringParameters: {},
      stageVariables: {},
      resource: "/",
      path: "/gateways/example/v1/path",
      httpMethod: "GET",
      headers: {},
      multiValueHeaders: {},
      requestContext: {
        authorizer: null,
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
    },
    overrides,
  );
export const gatewayEvent = createGatewayEvent();

export const createMatchedRoute = (overrides: DeepPartial<MatchedRoute> = {}) =>
  mergeFixture<MatchedRoute>(
    { key: routeKey, params: {}, config: { name: "example" } },
    overrides,
  );
export const matchedRoute = createMatchedRoute();

export const handlerContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "service-gateway",
  functionVersion: "$LATEST",
  invokedFunctionArn:
    "arn:aws:lambda:eu-west-2:123456789012:function:service-gateway",
  memoryLimitInMB: "128",
  awsRequestId: "test-request-id",
  logGroupName: "/aws/lambda/service-gateway",
  logStreamName: "test-stream",
  getRemainingTimeInMillis: () => 30_000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};
