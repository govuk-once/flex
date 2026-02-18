import {
  authorizerEvent,
  context,
  createAuthorizerEvent,
  invalidJwt,
  it,
  jwtMissingUsername,
  publicJWKS,
  validJwt,
} from "@flex/testing";
import {
  FailedAssertionError,
  JwtBaseError,
  JwtExpiredError,
  JwtNotBeforeError,
  JwtParseError,
} from "aws-jwt-verify/error";
import nock from "nock";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./handler";
import { createAuthService } from "./services/auth-service";

const TEST_USERPOOL_ID = "eu-west-2_testUserPoolId";
const COGNITO_BASE_URL = "https://cognito-idp.eu-west-2.amazonaws.com";
const JWKS_PATH = `/${TEST_USERPOOL_ID}/.well-known/jwks.json`;

const ROUTE_ARN =
  "arn:aws:execute-api:eu-west-2:123456789012:api-id/$default/GET/test";

vi.mock("@flex/params", () => {
  return {
    getConfig: vi.fn(() => ({
      AWS_REGION: "eu-west-2",
      USERPOOL_ID: TEST_USERPOOL_ID,
      CLIENT_ID: "testClientId",
      JWKS_URI: `${COGNITO_BASE_URL}${JWKS_PATH}`,
    })),
  };
});

vi.mock("./services/auth-service", async () => {
  const actual = await vi.importActual<
    typeof import("./services/auth-service")
  >("./services/auth-service");
  return {
    ...actual,
    createAuthService: vi.fn(actual.createAuthService),
  };
});

function expectDenyPolicy(context?: Record<string, string>) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return expect.objectContaining({
    principalId: "anonymous",
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: "Deny",
          Resource: ROUTE_ARN,
        },
      ],
    },
    ...(context && { context }),
  });
}

describe("Authorizer Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();
  });

  it("returns an allow policy containing the pairwise ID when the username can be extracted from a valid JWT", async ({
    authorizerResult,
  }) => {
    nock(COGNITO_BASE_URL).get(JWKS_PATH).reply(200, publicJWKS);

    expect(await handler(authorizerEvent, context)).toEqual(
      authorizerResult.allowWithPairwiseId(),
    );
  });

  it.each([
    {
      label: "the authorization header is missing",
      getEvent: (evt: ReturnType<typeof createAuthorizerEvent>) =>
        evt.missingToken(),
      nockStatus: undefined,
      nockBody: undefined,
    },
    {
      label: "the Bearer token is empty",
      getEvent: (evt: ReturnType<typeof createAuthorizerEvent>) =>
        evt.withToken(""),
      nockStatus: undefined,
      nockBody: undefined,
    },
    {
      label: "the JWT is invalid",
      getEvent: (evt: ReturnType<typeof createAuthorizerEvent>) =>
        evt.withToken(invalidJwt),
      nockStatus: undefined,
      nockBody: undefined,
    },
    {
      label: "the JWT is valid but missing the username claim",
      getEvent: (evt: ReturnType<typeof createAuthorizerEvent>) =>
        evt.withToken(jwtMissingUsername),
      nockStatus: 200,
      nockBody: publicJWKS,
    },
    {
      label: "the JWKS endpoint is unavailable",
      getEvent: (evt: ReturnType<typeof createAuthorizerEvent>) =>
        evt.withToken(validJwt),
      nockStatus: 500,
      nockBody: "Internal Server Error",
    },
  ])(
    "returns explicit deny when $label",
    async ({ getEvent, nockStatus, nockBody }) => {
      const evt = createAuthorizerEvent();
      const event = getEvent(evt);

      if (typeof nockStatus === "number") {
        nock(COGNITO_BASE_URL).get(JWKS_PATH).reply(nockStatus, nockBody);
      }
      await expect(handler(event, context)).resolves.toEqual(
        expectDenyPolicy(),
      );
    },
  );

  it.each([
    {
      label: "JwtExpiredError",
      error: new JwtExpiredError("JWT expired", null, "exp"),
      expectedContext: { error: "JWT expired" },
    },
    {
      label: "JwtNotBeforeError",
      error: new JwtNotBeforeError("JWT not yet valid", null, "nbf"),
      expectedContext: { error: "JWT not yet valid" },
    },
    {
      label: "FailedAssertionError",
      error: new FailedAssertionError(
        "Missing authorization token",
        undefined,
        "authorization token",
      ),
      expectedContext: { error: "Missing authorization token" },
    },
    {
      label: "generic JwtBaseError",
      error: new JwtParseError("Invalid JWT header"),
      expectedContext: undefined,
    },
  ])(
    "returns Deny with expected context for $label",
    async ({ error, expectedContext }) => {
      vi.mocked(createAuthService).mockResolvedValueOnce({
        extractPairwiseId: vi.fn().mockRejectedValue(error),
      });

      const evt = createAuthorizerEvent();
      await expect(handler(evt.withToken(validJwt), context)).resolves.toEqual(
        expectDenyPolicy(expectedContext),
      );
    },
  );

  it("rethrows non-JwtBaseError (unknown errors are not turned into Deny)", async ({
    authorizerEvent,
  }) => {
    const unknownError = new Error("Unknown error");
    // Plain Error is NOT a JwtBaseError, so handler must rethrow, not return Deny
    expect(unknownError).not.toBeInstanceOf(JwtBaseError);

    vi.mocked(createAuthService).mockResolvedValueOnce({
      extractPairwiseId: vi.fn().mockRejectedValue(unknownError),
    });

    await expect(
      handler(authorizerEvent.withToken(validJwt), context),
    ).resolves.toEqual({
      statusCode: 500,
      headers: {},
    });
  });
});
