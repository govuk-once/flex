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

import { getUserProfile } from "./userProfile";

vi.mock("@flex/logging");
vi.mock("@flex/flex-fetch");

describe("getUserProfile", () => {
  const appId = "test-app-id";
  const notificationId = "test-notification-id";
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

  it("creates user and returns preferences when missing", async () => {
    nock(BASE_URL)
      .get("/gateways/udp/v1/notifications")
      .reply(404, { message: "Not Found" })
      .post("/domains/udp/v1/user", { notificationId, appId })
      .reply(200, { message: "User created successfully" })
      .post("/gateways/udp/v1/notifications", {
        preferences: {
          notifications: { consentStatus: "unknown" },
        },
      })
      .reply(200, {})
      .get("/gateways/udp/v1/notifications")
      .reply(200, {
        preferences: {
          notifications: { consentStatus: "unknown" },
        },
      });

    const result = await getUserProfile({
      region,
      baseUrl: BASE_URL,
      notificationId,
      appId,
    });

    expect(result).toEqual({
      preferences: {
        notifications: { consentStatus: "unknown" },
      },
      notificationId,
      appId,
    });
  });

  it.each([401, 422, 500])(
    "throws BadGateway when preferences returns %s",
    async (statusCode) => {
      nock(BASE_URL)
        .get("/gateways/udp/v1/notifications")
        .reply(statusCode, { message: "Upstream error" });

      await expect(
        getUserProfile({
          region,
          baseUrl: BASE_URL,
          notificationId,
          appId,
        }),
      ).rejects.toMatchObject({
        status: 502,
      });
    },
  );
});
