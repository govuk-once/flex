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

import { getUserProfile } from "./userProfile";

vi.mock("@flex/logging", () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
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

describe("getUserProfile", () => {
  const notificationId = createNotificationId();
  const BASE_URL = "https://example.com";
  const region = "eu-west-2";

  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    expect(nock.isDone()).toBe(true);
    nock.cleanAll();
  });

  it("creates user and returns preferences when missing", async ({
    userId,
  }) => {
    nock(BASE_URL)
      .get("/gateways/udp/v1/notifications")
      .reply(404, { message: "Not Found" })
      .post("/domains/udp/v1/users", { notificationId, userId })
      .reply(200, { message: "User created successfully" })
      .post("/gateways/udp/v1/notifications", {
        consentStatus: "unknown",
        notificationId,
      })
      .reply(200, { consentStatus: "unknown", notificationId });

    const result = await getUserProfile({
      region,
      baseUrl: BASE_URL,
      notificationId,
      userId,
    });

    expect(result).toEqual({
      notificationId,
      userId,
      notifications: {
        consentStatus: "unknown",
        notificationId,
      },
    });
  });

  it("returns existing preferences when user already exists", async ({
    userId,
  }) => {
    nock(BASE_URL).get("/gateways/udp/v1/notifications").reply(200, {
      consentStatus: "accepted",
      notificationId,
    });

    const result = await getUserProfile({
      region,
      baseUrl: BASE_URL,
      notificationId,
      userId,
    });

    expect(result).toEqual({
      notificationId,
      userId,
      notifications: {
        consentStatus: "accepted",
        notificationId,
      },
    });
  });

  it.for([401, 422, 500])(
    "throws BadGateway when preferences returns %s",
    async (statusCode, { userId }) => {
      nock(BASE_URL)
        .get("/gateways/udp/v1/notifications")
        .reply(statusCode, { message: "Upstream error" });

      await expect(
        getUserProfile({
          region,
          baseUrl: BASE_URL,
          notificationId,
          userId,
        }),
      ).rejects.toMatchObject({
        statusCode: 502,
      });
    },
  );
});
