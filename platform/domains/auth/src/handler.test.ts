import { emitTelemetry, TelemetryEvent } from "@flex/telemetry";
import {
  invalidJwt,
  it,
  jwtMissingUsername,
  publicJWKS,
  validJwt,
  validJwtUsername,
} from "@flex/testing";
import {
  FailedAssertionError,
  JwtExpiredError,
  JwtParseError,
} from "aws-jwt-verify/error";
import { describe, expect, vi } from "vitest";

import { handler } from "./handler";
import { createAuthService } from "./services/auth-service";

vi.mock("@flex/telemetry");
vi.mock("./services/auth-service", { spy: true });

describe("Authorizer Handler", () => {
  const cognitoUrl = "https://cognito-idp.eu-west-2.amazonaws.com";
  const userPoolId = "eu-west-2_testUserPoolId";
  const clientId = "testClientId";
  const jwksPath = `/${userPoolId}/.well-known/jwks.json`;
  const jwksUri = `${cognitoUrl}${jwksPath}`;

  it.beforeEach(({ env }) => {
    env.set({
      USERPOOL_ID: userPoolId,
      CLIENT_ID: clientId,
      JWKS_URI: jwksUri,
    });

    vi.clearAllMocks();
  });

  it("returns an allow policy with the pairwise ID when a valid JWT username is present", async ({
    http,
    platform,
  }) => {
    http.url(cognitoUrl).get(jwksPath).reply(200, publicJWKS);

    const result = await handler(
      platform.authorizerEvent(),
      platform.context(),
    );

    expect(result).toStrictEqual(
      platform.authorizerResult("Allow", "*", {
        context: { pairwiseId: validJwtUsername },
      }),
    );
    expect(emitTelemetry).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvent.auth_success,
      { pairwiseId: validJwtUsername },
    );
  });

  describe("Token validation", () => {
    it.for<{
      reason: string;
      token: string;
      telemetryEvent: TelemetryEvent;
      jwks?: { status: number; body?: unknown };
    }>([
      {
        reason: "the authorization token is missing",
        token: "",
        telemetryEvent: TelemetryEvent.auth_token_missing,
      },
      {
        reason: 'the authorization token provides "Bearer" without a token',
        token: "Bearer",
        telemetryEvent: TelemetryEvent.auth_token_missing,
      },
      {
        reason: "the authorization token JWT is invalid",
        token: `Bearer ${invalidJwt}`,
        telemetryEvent: TelemetryEvent.auth_token_invalid,
      },
      {
        reason: "the authorization token username claim is missing",
        token: `Bearer ${jwtMissingUsername}`,
        telemetryEvent: TelemetryEvent.auth_claim_missing,
        jwks: { status: 200, body: publicJWKS },
      },
      {
        reason: "the JWKS endpoint is unavailable",
        token: `Bearer ${validJwt}`,
        telemetryEvent: TelemetryEvent.auth_token_invalid,
        jwks: { status: 500 },
      },
    ])(
      "returns a deny policy when $reason",
      async ({ telemetryEvent, token, jwks }, { http, platform }) => {
        if (jwks) {
          http.url(cognitoUrl).get(jwksPath).reply(jwks.status, jwks.body);
        }

        const event = platform.authorizerEvent({ authorizationToken: token });

        const result = await handler(event, platform.context());

        expect(result).toStrictEqual(
          platform.authorizerResult("Deny", event.methodArn),
        );
        expect(emitTelemetry).toHaveBeenCalledExactlyOnceWith(telemetryEvent, {
          reason: expect.any(String) as string,
        });
      },
    );
  });

  describe("Auth Service: Error handling", () => {
    it.for<{
      reason: string;
      error: Error;
      telemetryEvent: TelemetryEvent;
      context?: { errorMessage: string };
    }>([
      {
        reason: "the authorization token assertion fails",
        error: new FailedAssertionError(
          "Missing authorization token",
          undefined,
          "authorization token",
        ),
        telemetryEvent: TelemetryEvent.auth_token_missing,
      },
      {
        reason: "the JWT parsing fails",
        error: new JwtParseError("Invalid JWT header"),
        telemetryEvent: TelemetryEvent.auth_token_invalid,
      },
      {
        reason: "the JWT has expired",
        error: new JwtExpiredError("JWT expired", null, "exp"),
        telemetryEvent: TelemetryEvent.auth_token_expired,
      },
      {
        reason: "the failure is not a JWT error",
        error: new Error("Unknown error"),
        telemetryEvent: TelemetryEvent.auth_failure,
      },
    ])(
      "returns a deny policy when $reason",
      async ({ error, telemetryEvent, context }, { platform }) => {
        vi.mocked(createAuthService).mockReturnValueOnce({
          extractPairwiseId: vi.fn().mockRejectedValue(error),
        });

        const event = platform.authorizerEvent();

        const result = await handler(event, platform.context());

        expect(result).toStrictEqual(
          platform.authorizerResult("Deny", event.methodArn, { context }),
        );
        expect(emitTelemetry).toHaveBeenCalledExactlyOnceWith(telemetryEvent, {
          reason: error.message,
        });
      },
    );
  });
});
