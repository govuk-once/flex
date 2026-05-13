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
  apiPublicKey: "dvla-test-public-key", // pragma: allowlist secret
  apiPassword: "dvla-password", // pragma: allowlist secret
};

const MOCK_AUTH_RESPONSE = {
  "id-token": "mock-jwt-token",
  apiKeyExpiry: "2030-01-01T00:00:00Z", // pragma: allowlist secret
};

const MOCK_LICENCE_RESPONSE = {
  driver: { lastName: "DOE", drivingLicenceNumber: "SMITH999" },
  licence: { status: "Valid", type: "Full" },
};

const MOCK_CUSTOMER_RESPONSE = {
  linkingId: "test-linking-id",
  customerResponse: {
    customer: { customerId: "cust-123" },
  },
};

const MOCK_DRIVER_SUMMARY_RESPONSE = {
  linkingId: "test-linking-id",
  hasErrors: false,
  driverViewResponse: {
    driver: { drivingLicenceNumber: "SMITH999", lastName: "DOE" },
    licence: { status: "Valid", type: "Full" },
  },
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

const MOCK_MULTI_SHARE_CODE_RESPONSE = {
  linkingId: "test-linking-id",
  shareCodes: [MOCK_SHARE_CODE],
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
  licence: {
    get: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_LICENCE_RESPONSE,
    }),
  },
  customer: {
    get: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_CUSTOMER_RESPONSE,
    }),
  },
  driver: {
    get: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_DRIVER_SUMMARY_RESPONSE,
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
  shareCodes: {
    get: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: MOCK_MULTI_SHARE_CODE_RESPONSE,
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

  it("dispatches GET /v1/licence/:id and returns licence info", async ({
    privateGatewayEvent,
  }) => {
    const licenceId = "SMITH999";
    const jwt = "test-token";

    const response = await handler(
      privateGatewayEvent.get(`/gateways/dvla/v1/licence/${licenceId}`, {
        headers: { auth: jwt },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_LICENCE_RESPONSE),
    });

    expect(remoteClient.licence.get).toHaveBeenCalledWith(licenceId, jwt);
  });

  it("dispatches GET /v1/customer/:id and returns customer info", async ({
    privateGatewayEvent,
  }) => {
    const linkingId = "link-123";
    const jwt = "test-token";

    const response = await handler(
      privateGatewayEvent.get(`/gateways/dvla/v1/customer/${linkingId}`, {
        headers: { auth: jwt },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_CUSTOMER_RESPONSE),
    });

    expect(remoteClient.customer.get).toHaveBeenCalledWith(linkingId, jwt);
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

  it("dispatches GET /v1/driver-summary/:id and returns driver summary", async ({
    privateGatewayEvent,
  }) => {
    const jwt = "test-token";

    const response = await handler(
      privateGatewayEvent.get(
        "/gateways/dvla/v1/driver-summary/test-linking-id",
        {
          headers: { auth: jwt },
        },
      ),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_DRIVER_SUMMARY_RESPONSE),
    });

    expect(remoteClient.driver.get).toHaveBeenCalledWith(
      "test-linking-id",
      jwt,
    );
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
        {},
      ),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_VEHICLE_RESPONSE),
    });

    expect(remoteClient.vehicle.get).toHaveBeenCalledWith(registrationNumber);
  });

  it("dispatches GET /v1/share-codes and returns multiple share codes", async ({
    privateGatewayEvent,
  }) => {
    const jwt = "test-token";
    const linkingId = "test-linking-id";

    const response = await handler(
      privateGatewayEvent.get("/gateways/dvla/v1/share-codes", {
        headers: { auth: jwt },
        queryStringParameters: { linkingId },
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(MOCK_MULTI_SHARE_CODE_RESPONSE),
    });

    expect(remoteClient.shareCodes.get).toHaveBeenCalledWith(linkingId, jwt);
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
    remoteClient.licence.get.mockResolvedValue({
      ok: false,
      error: {
        status: 500,
        message: "Internal Server Error",
        body: { detail: "DVLA system down" },
      },
    });

    const response = await handler(
      privateGatewayEvent.get("/gateways/dvla/v1/licence/ID123", {
        headers: { auth: "jwt" },
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
    remoteClient.customer.get.mockResolvedValue({
      ok: false,
      error: {
        status: 404,
        message: "Customer not found",
        body: { code: "NOT_FOUND" },
      },
    });

    const response = await handler(
      privateGatewayEvent.get("/gateways/dvla/v1/customer/MISSING", {
        headers: { auth: "jwt" },
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
