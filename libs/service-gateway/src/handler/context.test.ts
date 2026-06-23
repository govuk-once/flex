import { logger } from "@flex/logging";
import { mergeFixture } from "@flex/testing";
import {
  DeepPartial,
  resolveHeaders,
  resolvePathParams,
  resolveQueryParams,
  resolveRequestBody,
} from "@flex/utils";
import type { APIGatewayProxyEvent } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import z from "zod";

import type { GatewayClient } from "../types";
import type { MatchedRoute } from "../utils/routes";
import { buildContext } from "./context";

vi.mock("@flex/utils", () => ({
  resolvePathParams: vi.fn(),
  resolveQueryParams: vi.fn(),
  resolveHeaders: vi.fn(),
  resolveRequestBody: vi.fn(),
}));

// TODO: Move to tests/fixtures.ts
export const createClient = (overrides: DeepPartial<GatewayClient> = {}) =>
  mergeFixture<GatewayClient>({ config: {}, request: vi.fn() }, overrides);
const client = createClient();
// TODO: Move to tests/fixtures.ts
const createEvent = (overrides: DeepPartial<APIGatewayProxyEvent> = {}) =>
  mergeFixture<APIGatewayProxyEvent>(
    {
      body: '{"key":"value"}',
      multiValueQueryStringParameters: {},
      pathParameters: { id: "1" },
      queryStringParameters: { a: "a", b: "b" },
      stageVariables: {},
      resource: "/",
      path: "/",
      httpMethod: "GET",
      headers: { "x-custom": "custom-value" },
      multiValueHeaders: {},
      requestContext: {
        authorizer: {
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
    },
    overrides,
  );
const event = createEvent();
// TODO: Move to tests/fixtures.ts
const createRoute = (overrides: DeepPartial<MatchedRoute> = {}) =>
  mergeFixture<MatchedRoute>(
    { key: "GET /v1/example", params: {}, config: { name: "example" } },
    overrides,
  );
const route = createRoute();
// TODO: Move to tests/fixtures.ts
const createContextOptions = (baseRoute = route) => ({
  client,
  logger,
  route: baseRoute,
});
const contextOptions = createContextOptions();

describe("buildContext", () => {
  beforeEach(() => {
    vi.mocked(resolvePathParams).mockReturnValue(undefined);
    vi.mocked(resolveQueryParams).mockReturnValue(undefined);
    vi.mocked(resolveHeaders).mockReturnValue(undefined);
    vi.mocked(resolveRequestBody).mockReturnValue(undefined);
  });

  it("returns only the client and logger when all resolvers return undefined", () => {
    expect(buildContext(event, contextOptions)).toStrictEqual({
      client,
      logger,
    });
  });

  it("returns the client, logger and pathParams when the event path parameters resolves with a value", () => {
    vi.mocked(resolvePathParams).mockReturnValue({ id: "123" });

    expect(buildContext(event, contextOptions)).toStrictEqual({
      client,
      logger,
      pathParams: { id: "123" },
    });
  });

  it("returns the client, logger and queryParams when the event query parameters resolves with a value", () => {
    vi.mocked(resolveQueryParams).mockReturnValue({ key: "value" });

    expect(buildContext(event, contextOptions)).toStrictEqual({
      client,
      logger,
      queryParams: { key: "value" },
    });
  });

  it("returns the client, logger and headers when the event headers resolves with a value", () => {
    vi.mocked(resolveHeaders).mockReturnValue({ auth: "token" });

    expect(buildContext(event, contextOptions)).toStrictEqual({
      client,
      logger,
      headers: { auth: "token" },
    });
  });

  it("returns the client, logger and body set to false when the event body resolves with a value", () => {
    vi.mocked(resolveRequestBody).mockReturnValue(false);

    expect(buildContext(event, contextOptions)).toStrictEqual({
      client,
      logger,
      body: false,
    });
  });

  it("omits the body when the even body resolves as undefined", () => {
    expect(buildContext(event, contextOptions)).not.toHaveProperty("body");
  });

  it("returns the whole context when all event resolvers return a value", () => {
    vi.mocked(resolvePathParams).mockReturnValue({ id: "123" });
    vi.mocked(resolveQueryParams).mockReturnValue({ a: "a" });
    vi.mocked(resolveHeaders).mockReturnValue({ b: "b" });
    vi.mocked(resolveRequestBody).mockReturnValue({ c: "c" });

    expect(buildContext(event, contextOptions)).toStrictEqual({
      client,
      logger,
      pathParams: { id: "123" },
      queryParams: { a: "a" },
      headers: { b: "b" },
      body: { c: "c" },
    });
  });

  it("verifies the correct event and route source are passed to each resolver", () => {
    const route = createRoute({
      params: { id: "abc" },
      config: {
        name: "example",
        query: z.unknown(),
        headers: { key: { name: "x-key" } },
        body: z.unknown(),
      },
    });

    buildContext(event, createContextOptions(route));

    expect(resolvePathParams).toHaveBeenCalledExactlyOnceWith(route.params);
    expect(resolveQueryParams).toHaveBeenCalledExactlyOnceWith(
      event.queryStringParameters,
      route.config.query,
    );
    expect(resolveHeaders).toHaveBeenCalledExactlyOnceWith(
      event.headers,
      route.config.headers,
    );
    expect(resolveRequestBody).toHaveBeenCalledExactlyOnceWith(
      event.body,
      route.config.body,
    );
  });
});
