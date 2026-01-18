import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { getCognitoJwks, getIssuer } from "./jwks";
import { getConfig } from "./config";

vi.mock("./config", async () => {
  return {
    getConfig: vi.fn(async () => ({
      awsRegion: "eu-west-2",
      userPoolId: "eu-west-2_testUserPoolId",
      clientId: "testClientId",
      redisEndpoint: "testRedisEndpoint",
    })),
  };
});

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

const config = await getConfig();

const server = setupServer(http.get(getIssuer(config.AWS_REGION, config.USERPOOL_ID) + "/.well-known/jwks.json", () => {
  return HttpResponse.json(exampleJWKS);
}));

describe("JWKS", () => {
  beforeAll(() => {
    server.listen();
  });

  afterEach(() => server.resetHandlers())

  afterAll(() => server.close())

  describe("getCognitoJwks", async () => {
    const config = await getConfig();
    const userPoolId = config.USERPOOL_ID;
    const region = config.AWS_REGION;

    it("calls the dummy JWKS endpoint and returns the parsed JWKS payload", async () => {
      const result = await getCognitoJwks(userPoolId, region);

      expect(result).toEqual(exampleJWKS);
    });

    it("throws a descriptive error when the JWKS endpoint response is not ok", async () => {
      server.use(http.get(getIssuer(region, userPoolId) + "/.well-known/jwks.json", () => {
        return HttpResponse.json({}, { status: 500, statusText: "Internal Server Error" });
      }));

      await expect(getCognitoJwks(userPoolId, region)).rejects.toThrow(
        "Failed to fetch JWKS from Cognito JWKS endpoint: 500 Internal Server Error",
      );
    });

    it("throws an error when the JWK object is invalid", async () => {
      const invalidJwksPayload = {
        invalidKey: "invalidValue",
      };

      server.use(
      http.get(getIssuer(region, userPoolId) + "/.well-known/jwks.json", () => {
        return HttpResponse.json(invalidJwksPayload);
      }))

      await expect(getCognitoJwks(userPoolId, region)).rejects.toThrow(
        /Invalid JWKS data:/,
      );
    });
  });

  describe("getIssuer", () => {
    it("constructs the correct issuer URL", () => {
      const region = "us-east-1";
      const userPoolId = "us-east-1_123456789";

      const issuer = getIssuer(region, userPoolId);

      expect(issuer).toBe("https://cognito-idp.us-east-1.amazonaws.com/us-east-1_123456789");
    });
  });
});
