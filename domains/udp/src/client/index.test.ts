import { it } from "@flex/testing";
import { createNotificationId } from "@test/fixtures";
import nock from "nock";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  vi,
} from "vitest";

import { createUdpDomainClient } from ".";

const BASE_URL = "https://udp-domain.example.com";
const region = "us-east-1";

vi.mock("@flex/logging");
vi.mock("@flex/flex-fetch");

describe("UdpDomainClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  afterEach(() => {
    expect(nock.isDone()).toBe(true);
    nock.cleanAll();
  });

  it.for([
    {
      name: "ECONNREFUSED",
      error: new Error("ECONNREFUSED"),
      expectedError: "ECONNREFUSED",
    },
    {
      name: "ECONNRESET",
      error: new Error("ECONNRESET"),
      expectedError: "ECONNRESET",
    },
  ])(
    "propagates $name network error to the caller",
    async ({ error, expectedError }, { userId }) => {
      nock(BASE_URL)
        .get("/gateways/udp/v1/notifications")
        .replyWithError(error);

      const client = createUdpDomainClient({
        region,
        baseUrl: BASE_URL,
      });

      await expect(client.gateway.notifications.get(userId)).rejects.toThrow(
        expectedError,
      );
    },
  );

  it.for([
    {
      name: "400 Bad Request",
      status: 400,
      body: { message: "Bad Request" },
      expectedError: "Bad Request",
    },
    {
      name: "401 Unauthorized",
      status: 401,
      body: { message: "Unauthorized" },
      expectedError: "Unauthorized",
    },
    {
      name: "403 Forbidden",
      status: 403,
      body: { message: "Forbidden" },
      expectedError: "Forbidden",
    },
    {
      name: "404 Not Found",
      status: 404,
      body: { message: "Not Found" },
      expectedError: "Not Found",
    },
  ])(
    "propagates $name client-side error to the caller",
    async ({ status, body, expectedError }, { userId }) => {
      nock(BASE_URL).get("/gateways/udp/v1/notifications").reply(status, body);

      const client = createUdpDomainClient({
        region,
        baseUrl: BASE_URL,
      });

      const result = await client.gateway.notifications.get(userId);

      expect(result).toEqual({
        ok: false,
        error: {
          status,
          message: expectedError,
          body,
        },
      });
    },
  );

  it("returns validated response from notifications.get matching the expected schema", async ({
    userId,
  }) => {
    nock(BASE_URL).get("/gateways/udp/v1/notifications").reply(200, {
      consentStatus: "accepted",
      notificationId: "notif-123",
    });

    const client = createUdpDomainClient({
      region,
      baseUrl: BASE_URL,
    });

    const result = await client.gateway.notifications.get(userId);

    expect(result).toEqual({
      ok: true,
      data: {
        consentStatus: "accepted",
        notificationId: "notif-123",
      },
      status: 200,
    });
  });

  it("returns status, data and body when schema is not provided", async ({
    userId,
  }) => {
    nock(BASE_URL).post("/domains/udp/v1/users").reply(200, {
      message: "User created successfully",
    });
    const client = createUdpDomainClient({
      region,
      baseUrl: BASE_URL,
    });

    const result = await client.domain.user.create({
      notificationId: createNotificationId(),
      userId,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        message: "User created successfully",
      },
      status: 200,
    });
  });

  it("returns ok false and error when schema validation fails", async ({
    userId,
  }) => {
    nock(BASE_URL)
      .get("/gateways/udp/v1/notifications")
      .reply(200, { invalid: "shape" });

    const client = createUdpDomainClient({
      baseUrl: BASE_URL,
      region,
    });
    const result = await client.gateway.notifications.get(userId);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(422);
    expect(result.error.message).toBe("Response validation failed");
    expect(result.error.body).toBeDefined();
  });

  describe("gateway.serviceLink.create", () => {
    const SERVICE = "test-service";
    const IDENTIFIER = "user-123";

    it("calls the correct endpoint with the provided service and serviceId", async ({
      userId,
    }) => {
      const body = { appId: userId };
      nock(BASE_URL)
        .post(
          `/gateways/udp/v1/identity/${SERVICE}/${IDENTIFIER}`,
          (actualBody) => {
            return JSON.stringify(actualBody) === JSON.stringify(body);
          },
        )
        .reply(201);

      const client = createUdpDomainClient({
        region,
        baseUrl: BASE_URL,
      });

      const result = await client.gateway.serviceLink.create(
        SERVICE,
        IDENTIFIER,
        body,
      );

      expect(result).toEqual({
        ok: true,
        status: 201,
      });
    });

    it("includes correct headers in the request", async ({ userId }) => {
      nock(BASE_URL)
        .post(/.*/)
        .matchHeader("Content-Type", "application/json")
        .reply(201);

      const client = createUdpDomainClient({
        region,
        baseUrl: BASE_URL,
      });

      const result = await client.gateway.serviceLink.create(
        SERVICE,
        IDENTIFIER,
        { appId: userId },
      );
      expect(result.ok).toBe(true);
    });
  });

  describe("gateway.serviceLink.delete", () => {
    const SERVICE = "test-service";
    const IDENTIFIER = "test-identifier";

    it("calls the correct endpoint with the provided service and serviceId", async () => {
      nock(BASE_URL)
        .delete(`/gateways/udp/v1/identity/${SERVICE}/${IDENTIFIER}`)
        .reply(204);

      const client = createUdpDomainClient({
        region,
        baseUrl: BASE_URL,
      });

      const result = await client.gateway.serviceLink.delete(
        SERVICE,
        IDENTIFIER,
      );

      expect(result).toEqual({
        ok: true,
        status: 204,
      });
    });

    it("includes correct headers in the request", async () => {
      nock(BASE_URL)
        .delete(/.*/)
        .matchHeader("Content-Type", "application/json")
        .reply(204);

      const client = createUdpDomainClient({
        region,
        baseUrl: BASE_URL,
      });

      const result = await client.gateway.serviceLink.delete(
        SERVICE,
        IDENTIFIER,
      );

      expect(result.ok).toBe(true);
    });
  });

  describe("gateway.serviceLink.get", () => {
    const SERVICE = "test-service";
    const USER_ID = "test-user-id";
    const MOCK_RESPONSE = { serviceId: "internal-id-123" };

    it("calls the correct endpoint and passes the userId in the User-Id header", async () => {
      nock(BASE_URL)
        .get(`/gateways/udp/v1/identity/${SERVICE}`)
        .matchHeader("User-Id", USER_ID)
        .reply(200, MOCK_RESPONSE);

      const client = createUdpDomainClient({
        region,
        baseUrl: BASE_URL,
      });

      const result = await client.gateway.serviceLink.get(SERVICE, USER_ID);

      expect(result).toEqual({
        ok: true,
        status: 200,
        data: MOCK_RESPONSE,
      });
    });

    it("includes mandatory application/json content-type header", async () => {
      nock(BASE_URL)
        .get(new RegExp(`${SERVICE}$`))
        .matchHeader("Content-Type", "application/json")
        .reply(200, MOCK_RESPONSE);

      const client = createUdpDomainClient({
        region,
        baseUrl: BASE_URL,
      });

      const result = await client.gateway.serviceLink.get(SERVICE, USER_ID);

      expect(result.ok).toBe(true);
    });
  });
});
