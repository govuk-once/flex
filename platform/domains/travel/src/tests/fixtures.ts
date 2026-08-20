import type { APIGatewayProxyEvent, Context } from "aws-lambda";

/**
 * Local REST API event and Lambda context fixtures.
 *
 * `@flex/testing` is published as raw TypeScript and declares
 * `@types/aws-lambda` as a devDependency, so its aws-lambda-typed fixtures
 * (`privateGatewayEvent`, `context`) resolve to error types anywhere those
 * devDependencies are not installed. Building both here keeps the gateway
 * tests typed against this package's own `@types/aws-lambda`.
 */
const baseEvent: APIGatewayProxyEvent = {
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
    authorizer: null,
    protocol: "HTTP/1.1",
    httpMethod: "GET",
    path: "/",
    accountId: "123456789012",
    apiId: "api-id",
    domainName: "api-id.execute-api.eu-west-2.amazonaws.com",
    domainPrefix: "api-id",
    requestId: "test-request-id",
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

export const restApiEvent = {
  get: (path: string): APIGatewayProxyEvent => ({
    ...baseEvent,
    path,
    resource: path,
    requestContext: { ...baseEvent.requestContext, path, resourcePath: path },
  }),
} as const;

export const context: Context = {
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
