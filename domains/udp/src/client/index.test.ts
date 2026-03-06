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

vi.mock("@flex/logging", () => ({
  getLogger: vi.fn().mockReturnValue({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@flex/flex-fetch", async (actual) => ({
  ...(await actual()),
  createSigv4Fetcher:
    ({ baseUrl }: { baseUrl: string }) =>
    (path: string, options?: RequestInit) => ({
      request: fetch(`${baseUrl}${path}`, options),
      abort: vi.fn(),
    }),
}));

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

  describe("gateway.createServiceLink", () => {
    const service = "test-service";
    const serviceId = "user-123";
    const body = { appId: "pairwise-id-999" };

    it("calls the correct endpoint with the provided service and serviceId", async () => {
      nock(BASE_URL)
        .post(
          `/gateways/udp/v1/identity/${service}/${serviceId}`,
          (actualBody) => {
            return JSON.stringify(actualBody) === JSON.stringify(body);
          },
        )
        .reply(201);

      const client = createUdpDomainClient({
        region,
        baseUrl: BASE_URL,
      });

      const result = await client.gateway.createServiceLink(
        service,
        serviceId,
        body,
      );

      expect(result).toEqual({
        ok: true,
        status: 201,
      });
    });

    it("includes correct headers in the request", async () => {
      nock(BASE_URL)
        .post(/.*/)
        .matchHeader("Content-Type", "application/json")
        .reply(201);

      const client = createUdpDomainClient({
        region,
        baseUrl: BASE_URL,
      });

      const result = await client.gateway.createServiceLink(
        service,
        serviceId,
        body,
      );
      expect(result.ok).toBe(true);
    });
  });
});
