import {
  authorizerEvent,
  context,
  invalidJwt,
  it,
  jwtMissingUsername,
  publicJWKS,
  validJwt,
} from "@flex/testing";
import { JwtBaseError } from "aws-jwt-verify/error";
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

function expectDenyPolicy() {
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

  it("returns explicit deny when the authorization header is missing", async ({
    authorizerEvent,
  }) => {
    await expect(
      handler(authorizerEvent.missingToken(), context),
    ).resolves.toEqual(expectDenyPolicy());
  });

  it("returns explicit deny when the Bearer token is empty", async ({
    authorizerEvent,
  }) => {
    await expect(
      handler(authorizerEvent.withToken(""), context),
    ).resolves.toEqual(expectDenyPolicy());
  });

  it("returns explicit deny when the JWT is invalid", async ({
    authorizerEvent,
  }) => {
    await expect(
      handler(authorizerEvent.withToken(invalidJwt), context),
    ).resolves.toEqual(expectDenyPolicy());
  });

  it("returns explicit deny when the JWT is valid but missing the username claim", async ({
    authorizerEvent,
  }) => {
    nock(COGNITO_BASE_URL).get(JWKS_PATH).reply(200, publicJWKS);

    await expect(
      handler(authorizerEvent.withToken(jwtMissingUsername), context),
    ).resolves.toEqual(expectDenyPolicy());
  });

  it("returns explicit deny when the JWKS endpoint is unavailable", async ({
    authorizerEvent,
  }) => {
    nock(COGNITO_BASE_URL).get(JWKS_PATH).reply(500, "Internal Server Error");

    await expect(
      handler(authorizerEvent.withToken(validJwt), context),
    ).resolves.toEqual(expectDenyPolicy());
  });

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
