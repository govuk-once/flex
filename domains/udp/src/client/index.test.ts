import nock from "nock";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
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

  // ensures tests fail if a request is not intercepted or mock is missing
  beforeAll(() => {
    nock.disableNetConnect();
  });
  afterAll(() => {
    nock.enableNetConnect();
  });

  // ensures tests fail if a request is not mocked
  afterEach(() => {
    expect(nock.isDone()).toBe(true);
    nock.cleanAll();
  });

  it.each([
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
    async ({ error, expectedError }) => {
      nock(BASE_URL).get("/gateways/udp/v1/preferences").replyWithError(error);

      const client = createUdpDomainClient({
        region,
        baseUrl: BASE_URL,
      });

      await expect(client.gateway.getPreferences()).rejects.toThrow(
        expectedError,
      );
    },
  );

  it.each([
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
    async ({ status, body, expectedError }) => {
      nock(BASE_URL).get("/gateways/udp/v1/preferences").reply(status, body);

      const client = createUdpDomainClient({
        region,
        baseUrl: BASE_URL,
      });

      const result = await client.gateway.getPreferences();

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

  it("returns validated response from getPreferences matching the expected getPreferences schema", async () => {
    const updatedAt = new Date().toISOString();
    nock(BASE_URL)
      .get("/gateways/udp/v1/preferences")
      .reply(200, {
        preferences: {
          notifications: {
            consentStatus: "accepted",
            updatedAt,
          },
        },
      });

    const client = createUdpDomainClient({
      region,
      baseUrl: BASE_URL,
    });

    const result = await client.gateway.getPreferences();

    expect(result).toEqual({
      ok: true,
      data: {
        preferences: {
          notifications: {
            consentStatus: "accepted",
            updatedAt,
          },
        },
      },
      status: 200,
    });
  });

  it("returns status, data and body when schema is not provided", async () => {
    nock(BASE_URL).post("/domains/udp/v1/user").reply(200, {
      message: "User created successfully",
    });
    const client = createUdpDomainClient({
      region,
      baseUrl: BASE_URL,
    });

    const result = await client.domain.createUser({
      notificationId: "123",
      appId: "456",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        message: "User created successfully",
      },
      status: 200,
    });
  });

  it("returns ok false and error when schema validation fails", async () => {
    nock(BASE_URL)
      .get("/gateways/udp/v1/preferences")
      .reply(200, { invalid: "shape" });

    const client = createUdpDomainClient({
      baseUrl: BASE_URL,
      region,
    });
    const result = await client.gateway.getPreferences();

    expect(result.ok).toBe(false);

    const { error } = result as Extract<typeof result, { ok: false }>;

    expect(error.status).toBe(422);
    expect(error.message).toBe("Response validation failed");
    expect(error.body).toBeDefined();
  });
});
