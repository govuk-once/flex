import { getConfig } from "@flex/params";
import {
  authorizerEvent,
  context,
  exampleInvalidJWTMissingUsername,
  examplePublicJWKS,
  it,
} from "@flex/testing";
import nock from "nock";
import { beforeEach, describe, expect, vi } from "vitest";

import { configSchema, handler } from "./handler";

vi.mock("@flex/params", () => {
  return {
    getConfig: vi.fn(() => ({
      AWS_REGION: "eu-west-2",
      USERPOOL_ID: "eu-west-2_testUserPoolId",
      CLIENT_ID: "testClientId",
      REDIS_ENDPOINT: "testRedisEndpoint",
    })),
  };
});

describe("Authorizer Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("JWT validation", () => {
    it("sucessfully validates a valid JWT token against JWKS", async ({
      authorizerResult,
    }) => {
      const config = await getConfig(configSchema);

      nock(`https://cognito-idp.${config.AWS_REGION}.amazonaws.com`)
        .get(`/${config.USERPOOL_ID}/.well-known/jwks.json`)
        .reply(200, examplePublicJWKS);

      const result = await handler(authorizerEvent, context);

      expect(result).toEqual(authorizerResult.allowWithPairwiseId());
    });

    it("throws an error when an invalid JWT token is provided", async ({
      authorizerEvent,
    }) => {
      await expect(
        handler(authorizerEvent.withToken("invalid.jwt.token"), context),
      ).resolves.toEqual({
        body: "Invalid JWT: Invalid JWT. Header is not a valid JSON object: SyntaxError: Unexpected token '�', \"�{ږ'\" is not valid JSON",
        headers: {
          "Content-Type": "text/plain",
        },
        statusCode: 401,
      });
    });

    it("throws an error when no JWT token is provided", async ({
      authorizerEvent,
    }) => {
      await expect(
        handler(authorizerEvent.missingToken(), context),
      ).resolves.toEqual({
        body: "No authorization token provided",
        headers: {
          "Content-Type": "text/plain",
        },
        statusCode: 401,
      });
    });

    it("throws an error when JWT does not contain a pairwise ID", async ({
      authorizerEvent,
    }) => {
      const config = await getConfig(configSchema);

      nock(`https://cognito-idp.${config.AWS_REGION}.amazonaws.com`)
        .get(`/${config.USERPOOL_ID}/.well-known/jwks.json`)
        .reply(200, examplePublicJWKS);

      await expect(
        handler(
          authorizerEvent.withToken(exampleInvalidJWTMissingUsername),
          context,
        ),
      ).resolves.toEqual({
        body: "Invalid JWT: Pairwise ID (username) not found in JWT",
        headers: {
          "Content-Type": "text/plain",
        },
        statusCode: 401,
      });
    });
  });
});
