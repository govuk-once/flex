import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import type {
  APIGatewayAuthorizerEvent,
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent,
  Context,
} from "aws-lambda";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { COGNITO_JWKS_AUTH_PREFIX, handler } from "./handler";
import { getConfig } from "./config";
import { getIssuer } from "./jwks";
import { getRedisClient } from "./redis";

// Field order is important. HttpResponse.json() seems to have some odd field reordering behavior
const exampleJWKS = {
  keys: [{
    "kty": "RSA",
    "kid": "d27874f4304835544c315b62d5a29c9c", // pragma: allowlist secret
    "use": "sig",
    "n": "raTGoq4v21v6IxSicuNViuZQkPKMabsI1qrLQygMi6l95Ylov86BxxUhkDAgeiyQv9C0MsphDA__AcOD7vjEedu9i-MYmde593pRhkfoCxm48WvsWB-Fw3mph7ODFGCVTDmI-H6ofsJB9cGUpbn6H3zvEEoRpu-kHRYY3jS-OSpYzdzebmAbryoFnuJNGnkHJAqbAjQF7WJdGhC081UAjagwZ9lvxdgjM1w-HVIRN26EmOq9mlch4csQ5eov3Z8rkqSV8wWvcTmD3yMXoM8jo2nE909t8jrq4SCXsGelGH3-iKPSpNbnth5J94LUEsR0tHqRRECYQfVCNdAClhQ4yFxH4_NqoGPbOyjeIa8bIizFlislkYLfIbG4rJjfxCvVukbA5jvecSaYQCb_JVSMCCp-PWwNiZJDEPzwOn3-kmCRHOhbUzUEa5OKn43nTMrPxd3RLcdi3QWjUOEC1Ker4qOdIdHfNi6U8xb3HfC0Y8QUSXlseP-VTPf15u1jEN0Z", // pragma: allowlist secret
    "e": "AQAB",
    "alg": "RS256",
  }]
}
/**
 *  JWT contents. JWT generated using https://www.scottbrady.io/tools/jwt with the above JWKS:
 *  header: {
      "typ": "at+jwt",
      "alg": "RS256",
      "kid": "d27874f4304835544c315b62d5a29c9c" // pragma: allowlist secret
    }
 *  payload: {
      "iss": "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_testUserPoolId",
      "aud": "testClientId",
      "sub": "5be86359073c434bad2da3932222dabe", // pragma: allowlist secret
      "client_id": "my_client_app",
      "exp": 4072434877,
      "iat": 1768744550,
      "jti": "4bc0f0ca2bb8d878b9919f0b81228c1f" // pragma: allowlist secret
    }
 */
const exampleValidJWT = "eyJ0eXAiOiJhdCtqd3QiLCJhbGciOiJSUzI1NiIsImtpZCI6ImQyNzg3NGY0MzA0ODM1NTQ0YzMxNWI2MmQ1YTI5YzljIn0.eyJpc3MiOiJodHRwczovL2NvZ25pdG8taWRwLmV1LXdlc3QtMi5hbWF6b25hd3MuY29tL2V1LXdlc3QtMl90ZXN0VXNlclBvb2xJZCIsImF1ZCI6InRlc3RDbGllbnRJZCIsInN1YiI6IjViZTg2MzU5MDczYzQzNGJhZDJkYTM5MzIyMjJkYWJlIiwiY2xpZW50X2lkIjoibXlfY2xpZW50X2FwcCIsImV4cCI6NDA3MjQzNDg3NywiaWF0IjoxNzY4NzQ0NTUwLCJqdGkiOiI0YmMwZjBjYTJiYjhkODc4Yjk5MTlmMGI4MTIyOGMxZiJ9.kT8TmL5aNzLNH0qKfC59l5H2XJ1tKap4csuh40Vcd4tyO2LjGm927N8c8D7QK0pdxd_sjV64we4OWyhKvl7qCXLENBMi_4pMFIglHICcUVRJM6DmZUCgJ3T86x-MLqbIQtD0WZxJgD7SKL-yWZYd27NmPYCPuxV9B44IrKAUMWS17IZ0ButlgDXj8nTvg0nOSy5BH1DTMp1eZiMHUnAbKhoKYmeHeuYts8I7wzmiVlLYjBUVg5Y0tn_f3fSjSEfEyTDmEIbeYKsRezhwB0WlwFY6vS77Duwf4IChBw-bCtczg_vmM5UDTWSXP-0mE7oe00aSJI-ECBXmWBPPnJ19UfWZ6bSwt-eStC8vVwE83QuqCvJw7ew3kSgOZpCbf-WG-og4JQxxHxHNYZk8mfH5zerK52JvdUCjgW7x6Efq-EUz0XAfwckoMTqDStwybw7IZRx7PtqEqhAFjz93Gr3JllnYn24YRsgjvsiCO9xgdcYaVlcauIgRY1ozePWGR_Nw"; // pragma: allowlist secret

// Mock dependencies
vi.mock("@aws-lambda-powertools/parameters/ssm");
vi.mock("./redis", () => {
  const mockRedisClient = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    disconnect: vi.fn(),
  };

  return {
    getRedisClient: vi.fn(() => mockRedisClient),
    resetRedisClient: vi.fn(),
    createRedisClient: vi.fn(() => mockRedisClient),
  };
});

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

const baseEvent: APIGatewayAuthorizerEvent = {
  version: "2.0",
  type: "REQUEST",
  routeArn:
    "arn:aws:execute-api:eu-west-2:123456789012:abcdef123/test/GET/request",
  identitySource: [`Bearer ${exampleValidJWT}`],
  routeKey: "GET /test",
  rawPath: "/test",
  rawQueryString: "",
  headers: {
    authorization: `Bearer ${exampleValidJWT}`,
  },
  requestContext: {
    accountId: "123456789012",
    requestId: "test-request-id",
  },
  stageVariables: null,
} as unknown as APIGatewayRequestAuthorizerEvent;

const expectedPolicy: APIGatewayAuthorizerResult = {
  principalId: "anonymous",
  policyDocument: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "execute-api:Invoke",
        Effect: "Allow",
        Resource: "*",
      },
    ],
  },
};

const config = await getConfig();

const server = setupServer(http.get(getIssuer(config.AWS_REGION, config.USERPOOL_ID) + "/.well-known/jwks.json", () => {
  return HttpResponse.json(exampleJWKS);
}));

describe("Authorizer Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeAll(() => {
    server.listen();
  });
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  describe("Redis integration", () => {
    it("reads from Redis when cache key exists and does not write to Redis", async () => {
      const config = await getConfig();
      const mockRedisClient = await getRedisClient("");
      vi.mocked(mockRedisClient.get).mockResolvedValue(JSON.stringify(exampleJWKS));

      await handler(baseEvent, mockContext);

      expect(mockRedisClient.get).toHaveBeenCalledWith(`${COGNITO_JWKS_AUTH_PREFIX}${config.USERPOOL_ID}`);
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it("writes to Redis when cache key does not exist", async () => {
      const config = await getConfig();
      const mockRedisClient = await getRedisClient("");
      vi.mocked(mockRedisClient.get).mockResolvedValue(null);

      http.get(getIssuer(config.AWS_REGION, config.USERPOOL_ID) + "/.well-known/jwks.json", () => {
        return HttpResponse.json(exampleJWKS);
      });

      await handler(baseEvent, mockContext);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `${COGNITO_JWKS_AUTH_PREFIX}${config.USERPOOL_ID}`,
        JSON.stringify(exampleJWKS),
        300,
      );
    });
  });

  describe("JWT validation", () => {
    it("sucessfully validates a valid JWT token against JWKS", async () => {
      const config = await getConfig();
      http.get(`${getIssuer(config.AWS_REGION, config.USERPOOL_ID)}/.well-known/jwks.json`, () => {
        return HttpResponse.json(exampleJWKS);
      });

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
