import type {
  Context,
} from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handler } from "./handler";
import { getConfig } from "./config";

import { exampleInvalidJWTMissing, exampleJWKS } from "../test/mockJwks";
import { baseEvent, expectedPolicy } from "../test/mockRequestsAndResponses";

import nock from "nock";

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

const mockContext = {
  getRemainingTimeInMillis: () => 1000,
} as unknown as Context;

describe("Authorizer Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("JWT validation", () => {
    it("sucessfully validates a valid JWT token against JWKS", async () => {
      const config = await getConfig();

      nock(`https://cognito-idp.${config.AWS_REGION}.amazonaws.com`)
        .get(`/${config.USERPOOL_ID}/.well-known/jwks.json`)
        .reply(200, exampleJWKS);

      const result = await handler(baseEvent, mockContext);

      expect(result).toEqual(expectedPolicy);
    });

    it("throws an error when an invalid JWT token is provided", async () => {
      const invalidEvent = {
        ...baseEvent,
        headers: {
          authorization: "Bearer invalid.jwt.token"
        },
      };

      await expect(handler(invalidEvent, mockContext)).rejects.toThrow(
        /Invalid JWT/,
      );
    });

    it("throws an error when no JWT token is provided", async () => {
      const noTokenEvent = {
        ...baseEvent,
        headers: { },
      };
      await expect(handler(noTokenEvent, mockContext)).rejects.toThrow(
        "No authorization token provided",
      );
    });

    it("throws an error when JWT does not contain a pairwise ID", async () => {
      const config = await getConfig();

      nock(`https://cognito-idp.${config.AWS_REGION}.amazonaws.com`)
        .get(`/${config.USERPOOL_ID}/.well-known/jwks.json`)
        .reply(200, exampleJWKS);

      const eventWithoutPairwiseId = {
        ...baseEvent,
        headers: {
          authorization: `Bearer ${exampleInvalidJWTMissing}`
        },
      };

      await expect(handler(eventWithoutPairwiseId, mockContext)).rejects.toThrow(
        "Pairwise ID (username) not found in JWT",
      );
    });
  });
});
