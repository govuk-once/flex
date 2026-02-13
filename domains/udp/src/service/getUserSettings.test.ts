import createHttpError from "http-errors";
import nock from "nock";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SERVICE_NAME } from "../constants";
import { getUserSettings } from "./getUserSettings";

const PRIVATE_GATEWAY_ORIGIN = "https://execute-api.eu-west-2.amazonaws.com";
const PATHS = {
  notifications: "/gateways/udp/notifications",
  analytics: "/gateways/udp/analytics",
} as const;

vi.mock("@flex/logging", () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));
vi.mock("aws-sigv4-fetch", () => ({
  createSignedFetcher: vi.fn(() => fetch),
}));

describe("getUserSettings", () => {
  const baseUrl = new URL(PRIVATE_GATEWAY_ORIGIN);
  const region = "eu-west-2";
  const pairwiseId = "test-pairwise-id";

  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();
  });

  it("returns merged notifications and analytics when both GETs return 200", async () => {
    const notificationsData = {
      consentStatus: "granted",
      updatedAt: "2025-01-01T00:00:00Z",
    };
    const analyticsData = {
      consentStatus: "denied",
      updatedAt: "2025-01-02T00:00:00Z",
    };

    nock(PRIVATE_GATEWAY_ORIGIN)
      .get(PATHS.notifications)
      .matchHeader("requesting-service", SERVICE_NAME)
      .matchHeader("requesting-service-user-id", pairwiseId)
      .reply(200, { data: notificationsData });
    nock(PRIVATE_GATEWAY_ORIGIN)
      .get(PATHS.analytics)
      .matchHeader("requesting-service", SERVICE_NAME)
      .matchHeader("requesting-service-user-id", pairwiseId)
      .reply(200, { data: analyticsData });

    const result = await getUserSettings({
      region,
      baseUrl,
      pairwiseId,
    });

    expect(result).toEqual({
      notifications: notificationsData,
      analytics: analyticsData,
    });
  });

  it("returns null when GET notifications returns 404", async () => {
    nock(PRIVATE_GATEWAY_ORIGIN).get(PATHS.notifications).reply(404, {});

    const result = await getUserSettings({
      region,
      baseUrl,
      pairwiseId,
    });

    expect(result).toBeNull();
  });

  it("throws BadGateway when GET notifications returns 500", async () => {
    nock(PRIVATE_GATEWAY_ORIGIN)
      .get(PATHS.notifications)
      .reply(500, { message: "Internal Server Error" });

    await expect(
      getUserSettings({ region, baseUrl, pairwiseId }),
    ).rejects.toThrow(createHttpError.BadGateway);
  });

  it("throws BadGateway when GET analytics returns 500", async () => {
    nock(PRIVATE_GATEWAY_ORIGIN)
      .get(PATHS.notifications)
      .reply(200, {
        data: { consentStatus: "unknown", updatedAt: "2025-01-01" },
      });
    nock(PRIVATE_GATEWAY_ORIGIN).get(PATHS.analytics).reply(500, {});

    await expect(
      getUserSettings({ region, baseUrl, pairwiseId }),
    ).rejects.toThrow(createHttpError.BadGateway);
  });

  it("sends requesting-service and requesting-service-user-id headers", async () => {
    const customPairwiseId = "custom-pairwise-id";
    nock(PRIVATE_GATEWAY_ORIGIN)
      .get(PATHS.notifications)
      .matchHeader("requesting-service", SERVICE_NAME)
      .matchHeader("requesting-service-user-id", customPairwiseId)
      .reply(200, { data: {} });
    nock(PRIVATE_GATEWAY_ORIGIN)
      .get(PATHS.analytics)
      .matchHeader("requesting-service", SERVICE_NAME)
      .matchHeader("requesting-service-user-id", customPairwiseId)
      .reply(200, { data: {} });

    const result = await getUserSettings({
      region,
      baseUrl,
      pairwiseId: customPairwiseId,
    });

    expect(result).toEqual({ notifications: {}, analytics: {} });
  });
});
