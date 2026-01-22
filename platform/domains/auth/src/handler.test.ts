import {
  authorizerEvent,
  context,
  exampleInvalidJWTMissingUsername,
  examplePublicJWKS,
  it,
} from "@flex/testing";
import type { Context } from "aws-lambda";
import nock from "nock";
import { beforeEach, describe, expect, vi } from "vitest";

import { getConfig } from "./config";
import { handler } from "./handler";

vi.mock("./config", async () => {
  return {
    getConfig: vi.fn(async () => ({
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
      const config = await getConfig();

      nock(`https://cognito-idp.${config.AWS_REGION}.amazonaws.com`)
        .get(`/${config.USERPOOL_ID}/.well-known/jwks.json`)
        .reply(200, examplePublicJWKS);

      const result = await handler(authorizerEvent, context);

      expect(result).toEqual(authorizerResult.allowWithPairwiseId());
    });

    it("throws an error when an invalid JWT token is provided", async ({
      authorizerEvent,
      authorizerResult,
    }) => {
      await expect(
        handler(authorizerEvent.withToken("invalid.jwt.token"), context),
      ).rejects.toThrow(/Invalid JWT/);
    });

    it("throws an error when no JWT token is provided", async ({
      authorizerEvent,
    }) => {
      await expect(
        handler(authorizerEvent.missingToken(), context),
      ).rejects.toThrow("No authorization token provided");
    });

    it("throws an error when JWT does not contain a pairwise ID", async ({
      authorizerEvent,
    }) => {
      const config = await getConfig();

      nock(`https://cognito-idp.${config.AWS_REGION}.amazonaws.com`)
        .get(`/${config.USERPOOL_ID}/.well-known/jwks.json`)
        .reply(200, examplePublicJWKS);

      await expect(
        handler(
          authorizerEvent.withToken(exampleInvalidJWTMissingUsername),
          context,
        ),
      ).rejects.toThrow("Pairwise ID (username) not found in JWT");
    });
  });
});
