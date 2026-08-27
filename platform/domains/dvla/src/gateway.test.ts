import type { HttpFixture } from "@flex/testing";
import { it, publicJWKS, validJwt } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./gateway";

const mockJwt = validJwt;
const mockPublicJwks = publicJWKS;
const mockLinkingId = "test-linking-id";
const mockToken = {
  "id-token": "mock-jwt-token",
  apiKeyExpiry: "2030-01-01T00:00:00Z", // pragma: allowlist secret
  passwordExpiry: "2030-01-01T00:00:00Z", // pragma: allowlist secret
};
const mockSecretArn =
  "arn:aws:secretsmanager:eu-west-2:123456789012:secret:dvla-consumer";

const mockConsumerConfig = {
  apiKey: "test-api-key", // pragma: allowlist secret
  apiUrl: "https://dvla-api.example.com",
  apiUsername: "test-api-username",
  apiPassword: "test-api-password", // pragma: allowlist secret
  wellKnownJwkUrl: "https://dvla-jwks-api.example.com",
};

const mockAuthHeaders = {
  Authorization: mockJwt,
  "X-API-KEY": mockConsumerConfig.apiKey, // pragma: allowlist secret
};

const stubConsumerConfig = (http: HttpFixture) =>
  http
    .url("https://secretsmanager.eu-west-2.amazonaws.com")
    .post("/")
    .reply(200, {
      ARN: mockSecretArn,
      Name: "dvla-consumer",
      SecretString: JSON.stringify(mockConsumerConfig),
    });

describe("DVLA Service Gateway", () => {
  it.beforeEach(({ env }) => {
    env.set({ FLEX_DVLA_CONSUMER_CONFIG_SECRET_ARN: mockSecretArn });
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

      http
        .url(mockConsumerConfig.apiUrl)
        .post("/thirdparty-access/v1/authenticate", {
          body: {
            userName: mockConsumerConfig.apiUsername,
            password: mockConsumerConfig.apiPassword, // pragma: allowlist secret
          },
        })
        .reply(500);

      const result = await handler(
        platform.gatewayEvent.get("/v1/authenticate"),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(502, {
          body: { message: "DVLA upstream service unavailable" },
        }),
      );
    });

    it("returns passthrough error provided by the upstream error response", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.apiUrl)
        .post("/thirdparty-access/v1/authenticate", {
          body: {
            userName: mockConsumerConfig.apiUsername,
            password: mockConsumerConfig.apiPassword, // pragma: allowlist secret
          },
        })
        .reply(404, { key: "value" });

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
        platform.gatewayEvent.get("/v1/customer/licence", {
          query: { linkingId: mockLinkingId },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(400, {
          body: { message: "Missing headers: auth", headers: ["auth"] },
        }),
      );
    });

    it("returns 400 when a required query parameter is missing", async ({
      platform,
    }) => {
      const result = await handler(
        platform.gatewayEvent.get("/v1/customer/licence", {
          headers: { auth: mockJwt },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(400, {
          body: {
            message: "Invalid query parameters",
            errors: [
              {
                field: "linkingId",
                message: "Invalid input: expected string, received undefined",
              },
            ],
          },
        }),
      );
    });
  });

  describe("GET /v1/authenticate", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns an auth token using the provided credentials", async ({
      http,
      platform,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/thirdparty-access/v1/authenticate", {
          body: {
            userName: mockConsumerConfig.apiUsername,
            password: mockConsumerConfig.apiPassword, // pragma: allowlist secret
          },
        })
        .reply(200, mockToken);

      const result = await handler(
        platform.gatewayEvent.get("/v1/authenticate"),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockToken }),
      );
    });
  });

  describe("GET /v1/customer/licence", () => {
    const mockCustomerLicence = {
      driver: { lastName: "DOE" },
      licence: { status: "Valid" },
    };

    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the customer driving licence", async ({ http, platform }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/retrieve-customer-driving-licence", {
          headers: mockAuthHeaders,
          body: { linkingId: mockLinkingId },
        })
        .reply(200, mockCustomerLicence);

      const result = await handler(
        platform.gatewayEvent.get("/v1/customer/licence", {
          headers: { auth: mockJwt },
          query: { linkingId: mockLinkingId },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockCustomerLicence }),
      );
    });
  });

  describe("GET /v1/customer/vehicles", () => {
    const mockCustomerVehicles = {
      customerVehicles: [],
    };

    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the customer vehicles list", async ({ http, platform }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/find-customer-vehicles", {
          headers: mockAuthHeaders,
          body: { linkingId: mockLinkingId },
        })
        .reply(200, mockCustomerVehicles);

      const result = await handler(
        platform.gatewayEvent.get("/v1/customer/vehicles", {
          headers: { auth: mockJwt },
          query: { linkingId: mockLinkingId },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockCustomerVehicles }),
      );
    });
  });

  describe("GET /v1/customer/vehicle/:id", () => {
    const mockVehicleId = "test-customer-vehicle-id";
    const mockCustomerVehicle = {
      customerVehicleDetails: { vehicleId: mockVehicleId, make: "FORD" },
    };

    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the customer vehicle information for the given ID", async ({
      http,
      platform,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/retrieve-customer-vehicle-by-vehicle-id", {
          headers: mockAuthHeaders,
          body: { linkingId: mockLinkingId, vehicleId: mockVehicleId },
        })
        .reply(200, mockCustomerVehicle);

      const result = await handler(
        platform.gatewayEvent.get(`/v1/customer/vehicle/${mockVehicleId}`, {
          headers: { auth: mockJwt },
          query: { linkingId: mockLinkingId },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockCustomerVehicle }),
      );
    });
  });

  describe("GET /v1/vehicle-enquiry/:id", () => {
    const mockRegistrationNumber = "test-registration-number-id";
    const mockVehicleEnquiry = {
      registrationNumber: mockRegistrationNumber,
      taxStatus: "Taxed",
      motStatus: "Valid",
      make: "FORD",
      colour: "BLUE",
      fuelType: "PETROL",
    };

    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the vehicle information for the given ID", async ({
      http,
      platform,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/retrieve-vehicle-by-vrn", {
          headers: mockAuthHeaders,
          body: { registrationNumber: mockRegistrationNumber },
        })
        .reply(200, mockVehicleEnquiry);

      const result = await handler(
        platform.gatewayEvent.get(
          `/v1/vehicle-enquiry/${mockRegistrationNumber}`,
          { headers: { auth: mockJwt } },
        ),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockVehicleEnquiry }),
      );
    });
  });

  describe("GET /v1/well-known-jwks", () => {
    it("returns the public JWKS then caches for subsequent requests", async ({
      http,
      platform,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.wellKnownJwkUrl)
        .get("/.well-known/jwks.json")
        .reply(200, mockPublicJwks);

      const event = platform.gatewayEvent.get("/v1/well-known-jwks");
      const context = platform.context();

      const firstResult = await handler(event, context);
      const secondResult = await handler(event, context);

      const { JwkSetSchema } = await import("./schemas/domain/wellKnownJwk");

      expect(firstResult).toStrictEqual(
        platform.gatewayResult(200, {
          body: JwkSetSchema.parse(mockPublicJwks),
        }),
      );
      expect(secondResult).toStrictEqual(firstResult);
    });
  });

  describe("POST /v1/share-code", () => {
    const mockCreatedShareCode = {
      linkingId: mockLinkingId,
      shareCode: {
        state: "valid",
        tokenId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        token: "B2CDFGHJ",
        drivingLicenceNumber: "SMITH952052S99ABC",
        driverId: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
        documentReference: "REF12345",
        created: "2026-05-01T10:00:00Z",
        expiry: "2026-05-22T10:00:00Z",
        status: "active",
        cancelled: "2026-05-22T10:00:00Z",
      },
    };

    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the created share code", async ({ http, platform }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/create-driving-licence-share-code", {
          headers: mockAuthHeaders,
          body: { linkingId: mockLinkingId },
        })
        .reply(201, mockCreatedShareCode);

      const result = await handler(
        platform.gatewayEvent.post("/v1/share-code", {
          headers: { auth: mockJwt },
          query: { linkingId: mockLinkingId },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(201, { body: mockCreatedShareCode }),
      );
    });
  });

  describe("POST /v1/share-code/:id/cancel", () => {
    const mockTokenId = "test-token-id";
    const mockCancelledShareCode = {
      linkingId: mockLinkingId,
      shareCode: {
        state: "cancelled",
        tokenId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        token: "B2CDFGHJ",
        drivingLicenceNumber: "SMITH952052S99ABC",
        driverId: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
        documentReference: "REF12345",
        created: "2026-05-01T10:00:00Z",
        expiry: "2026-05-22T10:00:00Z",
        status: "active",
        cancelled: "2026-05-22T10:00:00Z",
      },
    };

    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns cancelled share code", async ({ http, platform }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/cancel-driving-licence-share-code", {
          headers: mockAuthHeaders,
          body: { linkingId: mockLinkingId, tokenId: mockTokenId },
        })
        .reply(201, mockCancelledShareCode);

      const result = await handler(
        platform.gatewayEvent.post(`/v1/share-code/${mockTokenId}/cancel`, {
          headers: { auth: mockJwt },
          query: { linkingId: mockLinkingId },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(201, { body: mockCancelledShareCode }),
      );
    });
  });

  describe("POST /v1/test-notification/:id", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns a success response and triggers a test notification for the given ID", async ({
      http,
      platform,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/test-notification", {
          headers: mockAuthHeaders,
          body: { linkingId: mockLinkingId },
        })
        .reply(200);

      const result = await handler(
        platform.gatewayEvent.post(`/v1/test-notification/${mockLinkingId}`, {
          headers: { auth: mockJwt },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(platform.gatewayResult(200));
    });
  });

  describe("POST /v1/unlink-user/:id", () => {
    const mockServiceId = "test-service-id";
    const mockUnlinkedUser = { success: true };

    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("unlinks user for the given ID and returns the unlinked user", async ({
      http,
      platform,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/unlink-customer", {
          headers: mockAuthHeaders,
          body: { linkingId: mockServiceId },
        })
        .reply(200, mockUnlinkedUser);

      const result = await handler(
        platform.gatewayEvent.post(`/v1/unlink-user/${mockServiceId}`, {
          headers: { auth: mockJwt },
        }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: mockUnlinkedUser }),
      );
    });
  });
});
