import { emitTelemetry, TelemetryEvent } from "@flex/telemetry";
import {
  context,
  createTokenAuthorizerEvent,
  invalidJwt,
  it,
  jwtMissingUsername,
  publicJWKS,
  tokenAuthorizerEvent,
  validJwt,
} from "@flex/testing";
import {
  FailedAssertionError,
  JwtExpiredError,
  JwtParseError,
} from "aws-jwt-verify/error";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./handler";
import { createAuthService } from "./services/auth-service";

vi.mock("@flex/telemetry");

const TEST_USERPOOL_ID = "eu-west-2_testUserPoolId";
const COGNITO_BASE_URL = "https://cognito-idp.eu-west-2.amazonaws.com";
const JWKS_PATH = `/${TEST_USERPOOL_ID}/.well-known/jwks.json`;

vi.mock("./services/auth-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./services/auth-service")>();

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
          Resource: tokenAuthorizerEvent.methodArn,
        },
      ],
    },
    ...(context && { context }),
  });
}

describe("Authorizer Handler", () => {
  beforeEach(() => {
    vi.stubEnv("AWS_REGION", "eu-west-2");
    vi.stubEnv("USERPOOL_ID", TEST_USERPOOL_ID);
    vi.stubEnv("CLIENT_ID", "testClientId");
    vi.stubEnv("JWKS_URI", `${COGNITO_BASE_URL}${JWKS_PATH}`);

    vi.clearAllMocks();
    nock.cleanAll();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns an allow policy containing the pairwise ID when the username can be extracted from a valid JWT", async ({
    authorizerResult,
  }) => {
    nock(COGNITO_BASE_URL).get(JWKS_PATH).reply(200, publicJWKS);

    expect(await handler(tokenAuthorizerEvent, context)).toEqual(
      authorizerResult.allowWithPairwiseId(),
    );
    expect(emitTelemetry).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvent.auth_success,
      { pairwiseId: expect.any(String) as string },
    );
  });

  it.each([
    {
      label: "the authorization header is missing",
      event: createTokenAuthorizerEvent().missingToken(),
      cognitoResponseStatus: undefined,
      cognitoResponseBody: undefined,
      expectedTelemetryEvent: TelemetryEvent.auth_token_missing,
    },
    {
      label: "the Bearer token is empty",
      event: createTokenAuthorizerEvent().withToken(""),
      cognitoResponseStatus: undefined,
      cognitoResponseBody: undefined,
      expectedTelemetryEvent: TelemetryEvent.auth_token_missing,
    },
    {
      label: "the JWT is invalid",
      event: createTokenAuthorizerEvent().withToken(invalidJwt),
      cognitoResponseStatus: undefined,
      cognitoResponseBody: undefined,
      expectedTelemetryEvent: TelemetryEvent.auth_token_invalid,
    },
    {
      label: "the JWT is valid but missing the username claim",
      event: createTokenAuthorizerEvent().withToken(jwtMissingUsername),
      cognitoResponseStatus: 200,
      cognitoResponseBody: publicJWKS,
      expectedTelemetryEvent: TelemetryEvent.auth_claim_missing,
    },
    {
      label: "the JWKS endpoint is unavailable",
      event: createTokenAuthorizerEvent().withToken(validJwt),
      cognitoResponseStatus: 500,
      cognitoResponseBody: "Internal Server Error",
      expectedTelemetryEvent: TelemetryEvent.auth_token_invalid,
    },
  ])(
    "returns explicit deny when $label",
    async ({
      event,
      cognitoResponseStatus,
      cognitoResponseBody,
      expectedTelemetryEvent,
    }) => {
      if (typeof cognitoResponseStatus === "number") {
        nock(COGNITO_BASE_URL)
          .get(JWKS_PATH)
          .reply(cognitoResponseStatus, cognitoResponseBody);
      }
      await expect(handler(event, context)).resolves.toEqual(
        expectDenyPolicy(),
      );
      expect(emitTelemetry).toHaveBeenCalledExactlyOnceWith(
        expectedTelemetryEvent,
        { reason: expect.any(String) as string },
      );
    },
  );

  it.each([
    {
      label: "JwtExpiredError",
      error: new JwtExpiredError("JWT expired", null, "exp"),
      expectedContext: { errorMessage: "JWT expired" },
      expectedTelemetryEvent: TelemetryEvent.auth_token_expired,
    },
    {
      label: "FailedAssertionError",
      error: new FailedAssertionError(
        "Missing authorization token",
        undefined,
        "authorization token",
      ),
      expectedContext: undefined,
      expectedTelemetryEvent: TelemetryEvent.auth_token_missing,
    },
    {
      label: "generic JwtBaseError",
      error: new JwtParseError("Invalid JWT header"),
      expectedContext: undefined,
      expectedTelemetryEvent: TelemetryEvent.auth_token_invalid,
    },
  ])(
    "returns Deny with expected context for $label",
    async ({ error, expectedContext, expectedTelemetryEvent }) => {
      vi.mocked(createAuthService).mockReturnValueOnce({
        extractPairwiseId: vi.fn().mockRejectedValue(error),
      });

      await expect(handler(tokenAuthorizerEvent, context)).resolves.toEqual(
        expectDenyPolicy(expectedContext),
      );
      expect(emitTelemetry).toHaveBeenCalledExactlyOnceWith(
        expectedTelemetryEvent,
        { reason: expect.any(String) as string },
      );
    },
  );

  it("returns Deny on non-JwtBaseError", async () => {
    const unknownError = new Error("Unknown error");

    vi.mocked(createAuthService).mockReturnValueOnce({
      extractPairwiseId: vi.fn().mockRejectedValue(unknownError),
    });

    await expect(
      handler(createTokenAuthorizerEvent().withToken(validJwt), context),
    ).resolves.toEqual(expectDenyPolicy());
    expect(emitTelemetry).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvent.auth_failure,
      { reason: "Unknown error" },
    );
  });
});
