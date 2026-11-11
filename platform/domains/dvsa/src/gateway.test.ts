import type { HttpFixture } from "@flex/testing";
import { it, validJwt } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./gateway";

const mockJwt = validJwt;
const mockSecretArn =
  "arn:aws:secretsmanager:eu-west-2:123456789012:secret:dvsa-consumer";

const mockAuthBaseUrl = "https://login.microsoftonline.com";
const mockAuthPath = "/tenant-id/oauth2/v2.0/token";

const mockConsumerConfig = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret", // pragma: allowlist secret
  apiKey: "test-api-key", // pragma: allowlist secret
  apiAuthUrl: `${mockAuthBaseUrl}${mockAuthPath}`,
  apiMotUrl: "https://history.mot.api.gov.uk",
};

const mockTokenResponse = {
  access_token: "mock-access-token",
  token_type: "Bearer",
  // Keep expires_in low so the in-memory auth cache is always stale between tests
  // (the cache requires >60s remaining to be reused)
  expires_in: 1,
  ext_expires_in: 1,
};

const stubConsumerConfig = (http: HttpFixture) =>
  http
    .url("https://secretsmanager.eu-west-2.amazonaws.com")
    .post("/")
    .reply(200, {
      ARN: mockSecretArn,
      Name: "dvsa-consumer",
      SecretString: JSON.stringify(mockConsumerConfig),
    });

describe("DVSA Service Gateway", () => {
  it.beforeEach(({ env }) => {
    env.set({ FLEX_DVSA_CONSUMER_CONFIG_SECRET_ARN: mockSecretArn });
  });

  describe("Error handling", () => {
    it("returns 404 for an unknown route", async ({ platform }) => {
      const result = await handler(
        platform.gatewayEvent.get("/v1/should-throw"),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(404, { body: { message: "Route not found" } }),
      );
    });

    it("returns 502 when the upstream service returns 5xx", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);

      http.url(mockAuthBaseUrl).post(mockAuthPath).reply(500);

      const result = await handler(
        platform.gatewayEvent.get("/v1/authenticate"),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(502, {
          body: { message: "DVSA upstream service unavailable" },
        }),
      );
    });

    it("returns passthrough error provided by the upstream error response", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);

      http.url(mockAuthBaseUrl).post(mockAuthPath).reply(404, { key: "value" });

      const result = await handler(
        platform.gatewayEvent.get("/v1/authenticate"),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(404, {
          body: { message: "Not Found", error: { key: "value" } },
        }),
      );
    });

    it("returns 400 when a required header is missing", async ({
      platform,
    }) => {
      const result = await handler(
        platform.gatewayEvent.get("/v1/vehicle/mot/AB12CDE"),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(400, {
          body: { message: "Missing headers: auth", headers: ["auth"] },
        }),
      );
    });
  });

  describe("GET /v1/authenticate", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns an OAuth2 access token using client credentials", async ({
      http,
      platform,
    }) => {
      http
        .url(mockAuthBaseUrl)
        .post(mockAuthPath)
        .reply(200, mockTokenResponse);

      const result = await handler(
        platform.gatewayEvent.get("/v1/authenticate"),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockTokenResponse }),
      );
    });
  });

  describe("GET /v1/vehicle/mot/:id", () => {
    const mockRegistration = "AB12CDE";
    const mockMotResponse = {
      registration: mockRegistration,
      make: "FORD",
      model: "FOCUS",
      firstUsedDate: "2015-03-20",
      fuelType: "Petrol",
      primaryColour: "Blue",
      hasOutstandingRecall: "No",
      motTests: [
        {
          completedDate: "2024-03-15T09:30:00.000Z",
          testResult: "PASSED",
          expiryDate: "2025-03-14",
          odometerValue: "45000",
          odometerUnit: "MI",
          odometerResultType: "READ",
          motTestNumber: "123456789012",
          dataSource: "DVSA",
          defects: [],
        },
      ],
    };

    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the MOT history for the given registration", async ({
      http,
      platform,
    }) => {
      http
        .url(mockConsumerConfig.apiMotUrl)
        .get(`/v1/trade/vehicles/registration/${mockRegistration}`, {
          headers: {
            Authorization: `Bearer ${mockJwt}`,
            "X-API-Key": mockConsumerConfig.apiKey, // pragma: allowlist secret
          },
        })
        .reply(200, mockMotResponse);

      const result = await handler(
        platform.gatewayEvent.get(`/v1/vehicle/mot/${mockRegistration}`, {
          headers: { auth: mockJwt },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockMotResponse }),
      );
    });
  });

  describe("Secret cache retry on auth failure", () => {
    it("clears cache and retries when DVSA returns 401", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);
      stubConsumerConfig(http);

      http
        .url(mockAuthBaseUrl)
        .post(mockAuthPath)
        .reply(401)
        .reply(200, mockTokenResponse);

      const result = await handler(
        platform.gatewayEvent.get("/v1/authenticate"),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockTokenResponse }),
      );
    });

    it("clears cache and retries when DVSA returns 403", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);
      stubConsumerConfig(http);

      http
        .url(mockAuthBaseUrl)
        .post(mockAuthPath)
        .reply(403)
        .reply(200, mockTokenResponse);

      const result = await handler(
        platform.gatewayEvent.get("/v1/authenticate"),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockTokenResponse }),
      );
    });

    it("returns the error when retry also fails", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);
      stubConsumerConfig(http);

      http.url(mockAuthBaseUrl).post(mockAuthPath).reply(401).reply(401);

      const result = await handler(
        platform.gatewayEvent.get("/v1/authenticate"),
        platform.context(),
      );

      expect(result).toMatchObject({ statusCode: 401 });
    });

    it("retries MOT route on 401 with fresh secret", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);
      stubConsumerConfig(http);

      const mockRegistration = "AB12CDE";
      const mockMotResponse = {
        registration: mockRegistration,
        make: "FORD",
      };

      http
        .url(mockConsumerConfig.apiMotUrl)
        .get(`/v1/trade/vehicles/registration/${mockRegistration}`, {
          headers: {
            Authorization: `Bearer ${mockJwt}`,
            "X-API-Key": mockConsumerConfig.apiKey, // pragma: allowlist secret
          },
        })
        .reply(401)
        .reply(200, mockMotResponse);

      const result = await handler(
        platform.gatewayEvent.get(`/v1/vehicle/mot/${mockRegistration}`, {
          headers: { auth: mockJwt },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockMotResponse }),
      );
    });

    it("does not retry on non-auth errors", async ({ http, platform }) => {
      stubConsumerConfig(http);

      http.url(mockAuthBaseUrl).post(mockAuthPath).reply(404);

      const result = await handler(
        platform.gatewayEvent.get("/v1/authenticate"),
        platform.context(),
      );

      expect(result).toMatchObject({ statusCode: 404 });
    });
  });
});
