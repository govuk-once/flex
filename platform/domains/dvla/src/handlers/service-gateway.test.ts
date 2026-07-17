import { context, it } from "@flex/testing";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";

import { createDvlaRemoteClient } from "../client";
import type { ConsumerConfig } from "../utils/getConsumerConfig";
import { getConsumerConfig } from "../utils/getConsumerConfig";
import { handler } from "./service-gateway";

vi.mock("../utils/getConsumerConfig", () => ({
  getConsumerConfig: vi.fn(),
}));

vi.mock("../client", () => ({
  createDvlaRemoteClient: vi.fn(),
}));

const TEST_SECRET_ARN =
  "arn:aws:secretsmanager:eu-west-2:123456789012:secret:dvla-consumer";

const TEST_CONSUMER_CONFIG: ConsumerConfig = {
  apiUrl: "https://dvla-remote.example.test",
  apiKey: "dvla-test-key", // pragma: allowlist secret
  apiUsername: "dvla-user",
  apiPassword: "dvla-password", // pragma: allowlist secret
  wellKnownJwkUrl: "https://dvla-jwks.example.test",
};

const MOCK_AUTH_RESPONSE = {
  "id-token": "mock-jwt-token",
  apiKeyExpiry: "2030-01-01T00:00:00Z", // pragma: allowlist secret
};

const MOCK_JWKS_RESPONSE = {
  keys: [
    {
      kty: "RSA",
      use: "sig",
      alg: "PS256",
      kid: "alias/nonprod-govuk-app-jwt-signing-key",
      n: "mock-n-string",
      e: "AQAB",
    },
  ],
};

const MOCK_CUSTOMER_VEHICLES_RESPONSE = {
  customerVehicles: [],
};

const MOCK_CUSTOMER_VEHICLE_RESPONSE = {
  customerVehicleDetails: { vehicleId: "veh-789", make: "FORD" },
};

const MOCK_CUSTOMER_LICENCE_RESPONSE = {
  driver: { lastName: "DOE" },
  licence: { status: "Valid" },
};

const MOCK_VEHICLE_RESPONSE = {
  registrationNumber: "AA11ABC",
  taxStatus: "Taxed",
  taxDueDate: "2025-12-01",
  motStatus: "Valid",
  motExpiryDate: "2025-06-15",
  make: "FORD",
  yearOfManufacture: 2022,
  engineCapacity: 1998,
  co2Emissions: 120,
  fuelType: "PETROL",
  markedForExport: false,
  colour: "BLUE",
  typeApproval: "M1",
  wheelplan: "2 AXLE RIGID BODY",
  revenueWeight: 1600,
  dateOfLastV5CIssued: "2023-01-10",
  euroStatus: "EURO 6",
  automatedVehicle: false,
};

const MOCK_SHARE_CODE = {
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
};

const MOCK_SINGLE_SHARE_CODE_RESPONSE = {
  linkingId: "test-linking-id",
  shareCode: MOCK_SHARE_CODE,
};

const MOCK_UNLINK_RESPONSE = { success: true };

const remoteClient = {
  authentication: {
    get: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_AUTH_RESPONSE,
    }),
  },
  wellKnownJwk: {
    get: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_JWKS_RESPONSE,
    }),
  },
  customerVehicles: {
    get: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_CUSTOMER_VEHICLES_RESPONSE,
    }),
  },
  customerVehicle: {
    get: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_CUSTOMER_VEHICLE_RESPONSE,
    }),
  },
  customerDrivingLicence: {
    get: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_CUSTOMER_LICENCE_RESPONSE,
    }),
  },
  notification: {
    post: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: undefined,
    }),
  },
  vehicle: {
    get: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_VEHICLE_RESPONSE,
    }),
  },
  shareCode: {
    post: vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      data: MOCK_SINGLE_SHARE_CODE_RESPONSE,
    }),
  },
  cancelShareCode: {
    post: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ...MOCK_SINGLE_SHARE_CODE_RESPONSE,
        shareCode: { ...MOCK_SHARE_CODE, state: "cancelled" },
      },
    }),
  },
  unlink: {
    post: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_UNLINK_RESPONSE,
    }),
  },
};

describe("DVLA Service Gateway", () => {
  beforeEach(() => {
    vi.stubEnv("AWS_REGION", "eu-west-2");
    vi.stubEnv("FLEX_DVLA_CONSUMER_CONFIG_SECRET_ARN", TEST_SECRET_ARN);

    vi.clearAllMocks();
    vi.mocked(getConsumerConfig).mockResolvedValue(TEST_CONSUMER_CONFIG);
    vi.mocked(createDvlaRemoteClient).mockReturnValue(remoteClient);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("dispatches GET /v1/authenticate and returns auth token", async ({
    privateGatewayEvent,
  }) => {
    const response = await handler(
      privateGatewayEvent.get("/gateways/dvla/v1/authenticate"),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_AUTH_RESPONSE),
    });

    expect(remoteClient.authentication.get).toHaveBeenCalled();
  });

  it("dispatches GET /v1/well-known-jwks and returns public key sets", async ({
    privateGatewayEvent,
  }) => {
    const response = await handler(
      privateGatewayEvent.get("/gateways/dvla/v1/well-known-jwks"),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_JWKS_RESPONSE),
    });

    expect(remoteClient.wellKnownJwk.get).toHaveBeenCalled();
  });

  it("dispatches GET /v1/customer/vehicles and returns vehicles list", async ({
    privateGatewayEvent,
  }) => {
    const jwt = "test-token";
    const linkingId = "link-123";

    const response = await handler(
      privateGatewayEvent.get("/gateways/dvla/v1/customer/vehicles", {
        headers: { auth: jwt },
        queryStringParameters: { linkingId },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_CUSTOMER_VEHICLES_RESPONSE),
    });

    expect(remoteClient.customerVehicles.get).toHaveBeenCalledWith(
      linkingId,
      jwt,
    );
  });

  it("dispatches GET /v1/customer/vehicle/:id and returns vehicle details", async ({
    privateGatewayEvent,
  }) => {
    const jwt = "test-token";
    const linkingId = "link-123";
    const vehicleId = "veh-789";

    const response = await handler(
      privateGatewayEvent.get(
        `/gateways/dvla/v1/customer/vehicle/${vehicleId}`,
        {
          headers: { auth: jwt },
          queryStringParameters: { linkingId },
        },
      ),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_CUSTOMER_VEHICLE_RESPONSE),
    });

    expect(remoteClient.customerVehicle.get).toHaveBeenCalledWith(
      linkingId,
      jwt,
      vehicleId,
    );
  });

  it("dispatches GET /v1/customer/licence and returns customer driving licence", async ({
    privateGatewayEvent,
  }) => {
    const jwt = "test-token";
    const linkingId = "link-123";

    const response = await handler(
      privateGatewayEvent.get("/gateways/dvla/v1/customer/licence", {
        headers: { auth: jwt },
        queryStringParameters: { linkingId },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_CUSTOMER_LICENCE_RESPONSE),
    });

    expect(remoteClient.customerDrivingLicence.get).toHaveBeenCalledWith(
      linkingId,
      jwt,
    );
  });

  it("dispatches POST /v1/notification/:id and returns success", async ({
    privateGatewayEvent,
  }) => {
    const linkingId = "notif-123";
    const jwt = "test-token";

    const response = await handler(
      privateGatewayEvent.post(
        `/gateways/dvla/v1/test-notification/${linkingId}`,
        {
          headers: { auth: jwt },
          body: {},
        },
      ),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: undefined,
    });

    expect(remoteClient.notification.post).toHaveBeenCalledWith(linkingId, jwt);
  });

  it("dispatches GET /v1/vehicle-enquiry and returns full vehicle details", async ({
    privateGatewayEvent,
  }) => {
    const registrationNumber = "AA11ABC";

    remoteClient.vehicle.get.mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_VEHICLE_RESPONSE,
    });

    const response = await handler(
      privateGatewayEvent.get(
        `/gateways/dvla/v1/vehicle-enquiry/${registrationNumber}`,
        { headers: { auth: "jwt" } },
      ),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_VEHICLE_RESPONSE),
    });

    expect(remoteClient.vehicle.get).toHaveBeenCalledWith(
      registrationNumber,
      "jwt",
    );
  });

  it("dispatches POST /v1/share-code and returns created share code", async ({
    privateGatewayEvent,
  }) => {
    const jwt = "test-token";
    const linkingId = "test-linking-id";

    const response = await handler(
      privateGatewayEvent.post("/gateways/dvla/v1/share-code", {
        headers: { auth: jwt },
        body: {},
        queryStringParameters: { linkingId },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_SINGLE_SHARE_CODE_RESPONSE),
    });

    expect(remoteClient.shareCode.post).toHaveBeenCalledWith(linkingId, jwt);
  });

  it("dispatches POST /v1/share-code/:id/cancel and returns cancelled share code", async ({
    privateGatewayEvent,
  }) => {
    const jwt = "test-token";
    const linkingId = "test-linking-id";
    const tokenId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

    const response = await handler(
      privateGatewayEvent.post(
        `/gateways/dvla/v1/share-code/${tokenId}/cancel`,
        {
          headers: { auth: jwt },
          queryStringParameters: { linkingId },
          body: {},
        },
      ),
      context,
    );

    const MOCK_DELETED_RESPONSE = {
      ...MOCK_SINGLE_SHARE_CODE_RESPONSE,
      shareCode: { ...MOCK_SHARE_CODE, state: "cancelled" },
    };

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_DELETED_RESPONSE),
    });

    expect(remoteClient.cancelShareCode.post).toHaveBeenCalledWith(
      linkingId,
      jwt,
      tokenId,
    );
  });

  it("dispatches POST /v1/unlink-user and returns success", async ({
    privateGatewayEvent,
  }) => {
    const jwt = "test-token";
    const serviceId = "service-123-abc";

    const response = await handler(
      privateGatewayEvent.post(`/gateways/dvla/v1/unlink-user/${serviceId}`, {
        headers: { auth: jwt },
        body: {},
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_UNLINK_RESPONSE),
    });

    expect(remoteClient.unlink.post).toHaveBeenCalledWith(serviceId, jwt);
  });

  it("maps remote 5xx errors to 502 with sanitized message", async ({
    privateGatewayEvent,
  }) => {
    remoteClient.customerDrivingLicence.get.mockResolvedValue({
      ok: false,
      error: {
        status: 500,
        message: "Internal Server Error",
        body: { detail: "DVLA system down" },
      },
    });

    const response = await handler(
      privateGatewayEvent.get("/gateways/dvla/v1/customer/licence", {
        headers: { auth: "jwt" },
        queryStringParameters: { linkingId: "123" },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "DVLA upstream service unavailable",
      }),
    });
  });

  it("passes through remote 4xx status and error body", async ({
    privateGatewayEvent,
  }) => {
    remoteClient.customerDrivingLicence.get.mockResolvedValue({
      ok: false,
      error: {
        status: 404,
        message: "Customer not found",
        body: { code: "NOT_FOUND" },
      },
    });

    const response = await handler(
      privateGatewayEvent.get("/gateways/dvla/v1/customer/licence", {
        headers: { auth: "jwt" },
        queryStringParameters: { linkingId: "123" },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Customer not found",
        error: { code: "NOT_FOUND" },
      }),
    });
  });

  it("returns 404 for unsupported routes", async ({ privateGatewayEvent }) => {
    const response = await handler(
      privateGatewayEvent.get("/gateways/dvla/v1/invalid-path"),
      context,
    );

    expect(response).toEqual({
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Route not found" }),
    });
  });
});
