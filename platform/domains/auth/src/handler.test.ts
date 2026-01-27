import {
  authorizerEvent,
  exampleInvalidJWTMissingUsername,
  examplePublicJWKS,
  it,
} from "@flex/testing";
import nock from "nock";
import { beforeEach, describe, expect, vi } from "vitest";

import { getConfig } from "./config";
import { handler } from "./handler";

vi.mock("./config", () => {
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
      context,
    }) => {
      const config = await getConfig();

      nock(`https://cognito-idp.${config.AWS_REGION}.amazonaws.com`)
        .get(`/${config.USERPOOL_ID}/.well-known/jwks.json`)
        .reply(200, examplePublicJWKS);

      const result = await handler(authorizerEvent, context.create());

      expect(result).toEqual(authorizerResult.allowWithPairwiseId());
    });

    it("throws an error when an invalid JWT token is provided", async ({
      authorizerEvent,
      context,
    }) => {
      await expect(
        handler(
          authorizerEvent.withToken("invalid.jwt.token"),
          context.create(),
        ),
      ).rejects.toThrow(/Invalid JWT/);
    });

    it("throws an error when no JWT token is provided", async ({
      authorizerEvent,
      context,
    }) => {
      await expect(
        handler(authorizerEvent.missingToken(), context.create()),
      ).rejects.toThrow("No authorization token provided");
    });

    it("throws an error when JWT does not contain a pairwise ID", async ({
      authorizerEvent,
      context,
    }) => {
      const config = await getConfig();

      nock(`https://cognito-idp.${config.AWS_REGION}.amazonaws.com`)
        .get(`/${config.USERPOOL_ID}/.well-known/jwks.json`)
        .reply(200, examplePublicJWKS);

      await expect(
        handler(
          authorizerEvent.withToken(exampleInvalidJWTMissingUsername),
          context.create(),
        ),
      ).rejects.toThrow("Pairwise ID (username) not found in JWT");
    });
  });
});
