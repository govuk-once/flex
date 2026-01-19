import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type {
  Context,
} from "aws-lambda";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { handler } from "./handler";
import { getConfig } from "./config";

import { exampleJWKS } from "../test/mockJwks";
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

const config = await getConfig();

// const server = setupServer(http.get("https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_testUserPoolId/.well-known/jwks.json", () => {
//   return HttpResponse.json(exampleJWKS);
// }));

const scope = nock(`https://cognito-idp.${config.AWS_REGION}.amazonaws.com`).get(`/${config.USERPOOL_ID}/.well-known/jwks.json`).reply(200, exampleJWKS);

describe("Authorizer Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // beforeAll(() => {
  //   server.listen();
  // });
  // afterEach(() => server.resetHandlers())
  // afterAll(() => server.close())

  describe("JWT validation", () => {
    it("sucessfully validates a valid JWT token against JWKS", async () => {
      const config = await getConfig();
      // http.get(`https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_testUserPoolId/.well-known/jwks.json`, () => {
      //   return HttpResponse.json(exampleJWKS);
      // });

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
  });
});
