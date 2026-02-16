import createHttpError from "http-errors";
import nock from "nock";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUdpDomainClient } from "../client";
import { SERVICE_NAME } from "../constants";
import { aggregateUserProfile, getUserProfile } from "./aggregateUserProfile";

const PRIVATE_GATEWAY_ORIGIN = "https://execute-api.eu-west-2.amazonaws.com";
const PATHS = {
  notifications: "/gateways/udp/v1/notifications",
  user: "/domains/udp/v1/user",
} as const;

vi.mock("@flex/logging", () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));
vi.mock("aws-sigv4-fetch", () => ({
  createSignedFetcher: vi.fn(() => fetch),
}));

describe("aggregateUserProfile", () => {
  const baseUrl = new URL(PRIVATE_GATEWAY_ORIGIN);
  const region = "eu-west-2";
  const pairwiseId = "test-pairwise-id";
  const notificationId = "test-notification-id";

  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();
  });

  describe("when user exists", () => {
    it("returns user profile from notifications", async () => {
      const notificationsData = {
        consentStatus: "consented",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
        .matchHeader("requesting-service", SERVICE_NAME)
        .matchHeader("requesting-service-user-id", pairwiseId)
        .reply(200, { data: notificationsData });
      // Second call (aggregateUserProfile always fetches again after first check)
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
        .reply(200, { data: notificationsData });

      const result = await aggregateUserProfile({
        region,
        baseUrl,
        pairwiseId,
        notificationId,
      });

      expect(result).toEqual({
        notifications: notificationsData,
      });
    });
  });

  describe("when user does not exist", () => {
    it("creates user and returns default profile", async () => {
      const updatedAt = new Date().toISOString();
      const defaultData = {
        consentStatus: "unknown",
        updatedAt,
      };

      // First getUserProfile: GET notifications → 404
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
        .matchHeader("requesting-service", SERVICE_NAME)
        .matchHeader("requesting-service-user-id", pairwiseId)
        .reply(404);

      // createUser: POST user
      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(PATHS.user, {
          notificationId,
          appId: pairwiseId,
        })
        .reply(201, {});

      // createUser: POST notifications
      nock(PRIVATE_GATEWAY_ORIGIN).post(PATHS.notifications).reply(200);

      // Second getUserProfile: GET notifications
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(PATHS.notifications)
        .reply(200, { data: defaultData });

      const result = await aggregateUserProfile({
        region,
        baseUrl,
        pairwiseId,
        notificationId,
      });

      expect(result).toEqual({
        notifications: defaultData,
      });
    });

    it("throws BadGateway when POST user returns non-OK response", async () => {
      nock(PRIVATE_GATEWAY_ORIGIN).get(PATHS.notifications).reply(404);
      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(PATHS.user)
        .reply(500, { message: "Internal Server Error" });

      await expect(
        aggregateUserProfile({
          region,
          baseUrl,
          pairwiseId,
          notificationId,
        }),
      ).rejects.toThrow(createHttpError.BadGateway);
    });
  });
});

describe("getUserProfile", () => {
  const baseUrl = new URL(PRIVATE_GATEWAY_ORIGIN);
  const region = "eu-west-2";
  const pairwiseId = "test-pairwise-id";

  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();
  });

  it("returns notifications when GET returns 200", async () => {
    const notificationsData = {
      consentStatus: "consented",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    nock(PRIVATE_GATEWAY_ORIGIN)
      .get(PATHS.notifications)
      .matchHeader("requesting-service", SERVICE_NAME)
      .matchHeader("requesting-service-user-id", pairwiseId)
      .reply(200, { data: notificationsData });

    const client = createUdpDomainClient({ region, baseUrl, pairwiseId });
    const result = await getUserProfile(client);

    expect(result).toEqual({
      notifications: notificationsData,
    });
  });

  it("returns null when GET notifications returns 404", async () => {
    nock(PRIVATE_GATEWAY_ORIGIN).get(PATHS.notifications).reply(404, {});

    const client = createUdpDomainClient({ region, baseUrl, pairwiseId });
    const result = await getUserProfile(client);

    expect(result).toBeNull();
  });

  it("throws BadGateway when GET notifications returns 500", async () => {
    nock(PRIVATE_GATEWAY_ORIGIN)
      .get(PATHS.notifications)
      .reply(500, { message: "Internal Server Error" });

    const client = createUdpDomainClient({ region, baseUrl, pairwiseId });

    await expect(getUserProfile(client)).rejects.toThrow(
      createHttpError.BadGateway,
    );
  });

  it("sends requesting-service and requesting-service-user-id headers", async () => {
    const customPairwiseId = "custom-pairwise-id";
    const consentData = {
      consentStatus: "unknown",
      updatedAt: "2025-01-01",
    };
    nock(PRIVATE_GATEWAY_ORIGIN)
      .get(PATHS.notifications)
      .matchHeader("requesting-service", SERVICE_NAME)
      .matchHeader("requesting-service-user-id", customPairwiseId)
      .reply(200, { data: consentData });

    const client = createUdpDomainClient({
      region,
      baseUrl,
      pairwiseId: customPairwiseId,
    });
    const result = await getUserProfile(client);

    expect(result).toEqual({
      notifications: consentData,
    });
  });
});
