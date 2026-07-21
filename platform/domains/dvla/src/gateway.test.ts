import { clearCaches } from "@aws-lambda-powertools/parameters";
import type { HttpFixture } from "@flex/testing";
import { context, it, publicJWKS, validJwt } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./gateway";

// TODO: FLEX-344 - Replace all mocks with platform fixtures

const mockJwt = validJwt;
const mockPublicJwks = publicJWKS;
const mockLinkingId = "test-linking-id";
const mockToken = {
  "id-token": "mock-jwt-token",
  apiKeyExpiry: "2030-01-01T00:00:00Z", // pragma: allowlist secret
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
const mockHeaders = {
  default: { "Content-Type": "application/json" },
  auth: { Authorization: mockJwt, "X-API-KEY": mockConsumerConfig.apiKey },
};

// TODO: Move to fixtures
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
    clearCaches();
    env.set({ FLEX_DVLA_CONSUMER_CONFIG_SECRET_ARN: mockSecretArn });
  });

  describe("Error handling", () => {
    it("returns 404 for an unknown route", async ({ privateGatewayEvent }) => {
      const result = await handler(
        privateGatewayEvent.get("/gateways/dvla/v1/should-throw"),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 404,
        headers: mockHeaders.default,
        body: JSON.stringify({ message: "Route not found" }),
      });
    });

    it("returns 502 when the upstream service returns 5xx", async ({
      http,
      privateGatewayEvent,
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
        privateGatewayEvent.get("/gateways/dvla/v1/authenticate"),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 502,
        headers: mockHeaders.default,
        body: JSON.stringify({ message: "DVLA upstream service unavailable" }),
      });
    });

    it("returns passthrough error provided by the upstream error response", async ({
      http,
      privateGatewayEvent,
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
        privateGatewayEvent.get("/gateways/dvla/v1/authenticate"),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 404,
        headers: mockHeaders.default,
        body: JSON.stringify({ message: "Not Found", error: { key: "value" } }),
      });
    });

    it("returns 400 when a required header is missing", async ({
      http,
      privateGatewayEvent,
    }) => {
      stubConsumerConfig(http);

      const result = await handler(
        privateGatewayEvent.get("/gateways/dvla/v1/customer/licence", {
          queryStringParameters: { linkingId: mockLinkingId },
        }),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 400,
        headers: mockHeaders.default,
        body: JSON.stringify({
          message: "Missing headers: auth",
          headers: ["auth"],
        }),
      });
    });

    it("returns 400 when a required query parameter is missing", async ({
      http,
      privateGatewayEvent,
    }) => {
      stubConsumerConfig(http);

      const result = await handler(
        privateGatewayEvent.get("/gateways/dvla/v1/customer/licence", {
          headers: { auth: mockJwt },
        }),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 400,
        headers: mockHeaders.default,
        body: JSON.stringify({
          message: "Invalid query parameters",
          errors: [
            {
              field: "linkingId",
              message: "Invalid input: expected string, received undefined",
            },
          ],
        }),
      });
    });
  });

  describe("GET /v1/authenticate", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns an auth token using the provided credentials", async ({
      http,
      privateGatewayEvent,
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
        privateGatewayEvent.get("/gateways/dvla/v1/authenticate"),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(mockToken),
      });
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

    it("returns the customer driving licence", async ({
      http,
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/retrieve-customer-driving-licence", {
          headers: mockHeaders.auth,
          body: { linkingId: mockLinkingId },
        })
        .reply(200, mockCustomerLicence);

      const result = await handler(
        privateGatewayEvent.get("/gateways/dvla/v1/customer/licence", {
          headers: { auth: mockJwt },
          queryStringParameters: { linkingId: mockLinkingId },
        }),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(mockCustomerLicence),
      });
    });
  });

  describe("GET /v1/customer/vehicles", () => {
    const mockCustomerVehicles = {
      customerVehicles: [],
    };

    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns the customer vehicles list", async ({
      http,
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/find-customer-vehicles", {
          headers: mockHeaders.auth,
          body: { linkingId: mockLinkingId },
        })
        .reply(200, mockCustomerVehicles);

      const result = await handler(
        privateGatewayEvent.get("/gateways/dvla/v1/customer/vehicles", {
          headers: { auth: mockJwt },
          queryStringParameters: { linkingId: mockLinkingId },
        }),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(mockCustomerVehicles),
      });
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
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/retrieve-customer-vehicle-by-vehicle-id", {
          headers: mockHeaders.auth,
          body: { linkingId: mockLinkingId, vehicleId: mockVehicleId },
        })
        .reply(200, mockCustomerVehicle);

      const result = await handler(
        privateGatewayEvent.get(
          `/gateways/dvla/v1/customer/vehicle/${mockVehicleId}`,
          {
            headers: { auth: mockJwt },
            queryStringParameters: { linkingId: mockLinkingId },
          },
        ),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(mockCustomerVehicle),
      });
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
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/retrieve-vehicle-by-vrn", {
          headers: mockHeaders.auth,
          body: { registrationNumber: mockRegistrationNumber },
        })
        .reply(200, mockVehicleEnquiry);

      const result = await handler(
        privateGatewayEvent.get(
          `/gateways/dvla/v1/vehicle-enquiry/${mockRegistrationNumber}`,
          { headers: { auth: mockJwt } },
        ),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(mockVehicleEnquiry),
      });
    });
  });

  describe("GET /v1/well-known-jwks", () => {
    it("returns the public JWKS then caches for subsequent requests", async ({
      http,
      privateGatewayEvent,
    }) => {
      stubConsumerConfig(http);

      http
        .url(mockConsumerConfig.wellKnownJwkUrl)
        .get("/.well-known/jwks.json")
        .reply(200, mockPublicJwks);

      const event = privateGatewayEvent.get(
        "/gateways/dvla/v1/well-known-jwks",
      );

      const firstResult = await handler(event, context);
      const secondResult = await handler(event, context);

      const { JwkSetSchema } = await import("./schemas/domain/wellKnownJwk");

      expect(firstResult).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(JwkSetSchema.parse(mockPublicJwks)),
      });
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

    it("returns the created share code", async ({
      http,
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/create-driving-licence-share-code", {
          headers: mockHeaders.auth,
          body: { linkingId: mockLinkingId },
        })
        .reply(201, mockCreatedShareCode);

      const result = await handler(
        privateGatewayEvent.post("/gateways/dvla/v1/share-code", {
          headers: { auth: mockJwt },
          queryStringParameters: { linkingId: mockLinkingId },
          body: undefined,
        }),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 201,
        headers: mockHeaders.default,
        body: JSON.stringify(mockCreatedShareCode),
      });
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

    it("returns cancelled share code", async ({
      http,
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/cancel-driving-licence-share-code", {
          headers: mockHeaders.auth,
          body: { linkingId: mockLinkingId, tokenId: mockTokenId },
        })
        .reply(201, mockCancelledShareCode);

      const result = await handler(
        privateGatewayEvent.post(
          `/gateways/dvla/v1/share-code/${mockTokenId}/cancel`,
          {
            headers: { auth: mockJwt },
            queryStringParameters: { linkingId: mockLinkingId },
            body: undefined,
          },
        ),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 201,
        headers: mockHeaders.default,
        body: JSON.stringify(mockCancelledShareCode),
      });
    });
  });

  describe("POST /v1/test-notification/:id", () => {
    it.beforeEach(({ http }) => {
      stubConsumerConfig(http);
    });

    it("returns a success response and triggers a test notification for the given ID", async ({
      http,
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/test-notification", {
          headers: mockHeaders.auth,
          body: { linkingId: mockLinkingId },
        })
        .reply(200);

      const result = await handler(
        privateGatewayEvent.post(
          `/gateways/dvla/v1/test-notification/${mockLinkingId}`,
          { headers: { auth: mockJwt }, body: undefined },
        ),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: undefined,
      });
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
      privateGatewayEvent,
    }) => {
      http
        .url(mockConsumerConfig.apiUrl)
        .post("/govuk-app-service/v1/unlink-customer", {
          headers: mockHeaders.auth,
          body: { linkingId: mockServiceId },
        })
        .reply(200, mockUnlinkedUser);

      const result = await handler(
        privateGatewayEvent.post(
          `/gateways/dvla/v1/unlink-user/${mockServiceId}`,
          { headers: { auth: mockJwt }, body: undefined },
        ),
        context,
      );

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: mockHeaders.default,
        body: JSON.stringify(mockUnlinkedUser),
      });
    });
  });
});
