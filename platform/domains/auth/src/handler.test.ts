import {
  authorizerEvent,
  context,
  invalidJwt,
  it,
  jwtMissingUsername,
  publicJWKS,
  validJwt,
} from "@flex/testing";
import nock from "nock";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./handler";

const TEST_USERPOOL_ID = "eu-west-2_testUserPoolId";
const COGNITO_BASE_URL = "https://cognito-idp.eu-west-2.amazonaws.com";
const JWKS_PATH = `/${TEST_USERPOOL_ID}/.well-known/jwks.json`;

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

  it("returns 401 when the authorization header is missing", async ({
    authorizerEvent,
  }) => {
    await expect(
      handler(authorizerEvent.missingToken(), context),
    ).resolves.toEqual(
      expect.objectContaining({
        statusCode: 401,
        body: "Missing authorization token",
      }),
    );
  });

  it("returns 401 when the Bearer token is empty", async ({
    authorizerEvent,
  }) => {
    await expect(
      handler(authorizerEvent.withToken(""), context),
    ).resolves.toEqual(
      expect.objectContaining({
        statusCode: 401,
        body: "Missing authorization token",
      }),
    );
  });

  it("returns 401 when the JWT is invalid", async ({ authorizerEvent }) => {
    await expect(
      handler(authorizerEvent.withToken(invalidJwt), context),
    ).resolves.toEqual(
      expect.objectContaining({
        statusCode: 401,
        body: expect.stringContaining(
          "Invalid JWT. Header is not a valid JSON object",
        ) as string,
      }),
    );
  });

  it("returns 401 when the JWT is valid but missing the username claim", async ({
    authorizerEvent,
  }) => {
    nock(COGNITO_BASE_URL).get(JWKS_PATH).reply(200, publicJWKS);

    await expect(
      handler(authorizerEvent.withToken(jwtMissingUsername), context),
    ).resolves.toEqual(
      expect.objectContaining({
        statusCode: 401,
        body: "JWT missing username claim",
      }),
    );
  });

  it("returns 401 when the JWKS endpoint is unavailable", async ({
    authorizerEvent,
  }) => {
    nock(COGNITO_BASE_URL).get(JWKS_PATH).reply(500, "Internal Server Error");

    await expect(
      handler(authorizerEvent.withToken(validJwt), context),
    ).resolves.toEqual(expect.objectContaining({ statusCode: 401 }));
  });
});
