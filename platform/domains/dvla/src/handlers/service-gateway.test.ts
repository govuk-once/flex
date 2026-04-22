import { getConfig } from "@flex/params";
import { context, it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";

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

vi.mock("@flex/params", () => ({
  getConfig: vi.fn(),
}));

const TEST_SECRET_ARN =
  "arn:aws:secretsmanager:eu-west-2:123456789012:secret:dvla-consumer";

const TEST_CONSUMER_CONFIG: ConsumerConfig = {
  apiUrl: "https://dvla-remote.example.test",
  apiKey: "dvla-test-key", // pragma: allowlist secret
  apiUsername: "dvla-user",
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
};

describe("DVLA Service Gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfig).mockResolvedValue({
      AWS_REGION: "eu-west-2",
      FLEX_DVLA_CONSUMER_CONFIG_SECRET_ARN: TEST_SECRET_ARN,
    });
    vi.mocked(getConsumerConfig).mockResolvedValue(TEST_CONSUMER_CONFIG);
    vi.mocked(createDvlaRemoteClient).mockReturnValue(remoteClient);
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

  it("returns 500 for unexpected exceptions", async ({
    privateGatewayEvent,
  }) => {
    vi.mocked(getConfig).mockRejectedValue(new Error("Secrets crash"));

    const response = await handler(
      privateGatewayEvent.get("/gateways/dvla/v1/authenticate"),
      context,
    );

    expect(response).toEqual({
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Internal server error" }),
    });
  });
});
