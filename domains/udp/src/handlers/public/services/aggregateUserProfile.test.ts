import createHttpError from "http-errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUdpDomainClient } from "../../../client";
import { CONSENT_STATUS } from "../../../schemas";
import {
  aggregateUserProfile,
  getNotificationPreferences,
} from "./aggregateUserProfile";

const PRIVATE_GATEWAY_ORIGIN = "https://execute-api.eu-west-2.amazonaws.com";

const mockGatewayFetch = vi.fn();
const mockDomainFetch = vi.fn();

vi.mock("@flex/logging", () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));
vi.mock("@flex/flex-fetch", () => ({
  createSigv4Fetch:
    (baseConfig: { headers?: Record<string, string> }) =>
    async (request: { method: string; path: string; body?: unknown }) =>
      mockGatewayFetch({ baseConfig, request }) as Promise<Response>,
  sigv4Fetch: (opts: { method: string; path: string; body?: unknown }) =>
    mockDomainFetch(opts) as Promise<Response>,
  flexFetch: vi.fn(),
}));

describe("aggregateUserProfile", () => {
  const baseUrl = new URL(PRIVATE_GATEWAY_ORIGIN);
  const region = "eu-west-2";
  const pairwiseId = "test-pairwise-id";
  const notificationId = "test-notification-id";

  const jsonHeaders = { "Content-Type": "application/json" };

  beforeEach(() => {
    mockGatewayFetch.mockReset();
    mockDomainFetch.mockReset();
  });

  describe("when user exists", () => {
    it("returns user profile from notifications", async () => {
      const notificationsData = {
        consentStatus: "consented",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      mockGatewayFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: notificationsData }), {
          status: 200,
          headers: jsonHeaders,
        }),
      );

      const result = await aggregateUserProfile({
        region,
        baseUrl,
        pairwiseId,
        notificationId,
      });

      expect(result).toEqual({
        notificationId,
        preferences: {
          notifications: {
            consentStatus: CONSENT_STATUS.CONSENTED,
            updatedAt: "2025-01-01T00:00:00Z",
          },
        },
      });
      expect(mockGatewayFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("when user does not exist", () => {
    it("creates user and returns default profile", async () => {
      const updatedAt = new Date().toISOString();
      const defaultData = {
        consentStatus: "unknown",
        updatedAt,
      };

      mockGatewayFetch
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: jsonHeaders,
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: defaultData }), {
            status: 200,
            headers: jsonHeaders,
          }),
        );
      mockDomainFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 201,
          headers: jsonHeaders,
        }),
      );

      const result = await aggregateUserProfile({
        region,
        baseUrl,
        pairwiseId,
        notificationId,
      });

      expect(result).toEqual({
        notificationId,
        preferences: {
          notifications: { consentStatus: CONSENT_STATUS.UNKNOWN, updatedAt },
        },
      });
    });

    it("throws BadGateway when POST user returns non-OK response", async () => {
      mockGatewayFetch.mockResolvedValueOnce(new Response("", { status: 404 }));
      mockDomainFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Internal Server Error" }), {
          status: 500,
          headers: jsonHeaders,
        }),
      );

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

describe("getNotificationPreferences", () => {
  const baseUrl = new URL(PRIVATE_GATEWAY_ORIGIN);
  const region = "eu-west-2";
  const pairwiseId = "test-pairwise-id";

  beforeEach(() => {
    mockGatewayFetch.mockReset();
    mockDomainFetch.mockReset();
  });

  it("returns notifications when client returns consent data", async () => {
    const notificationsData = {
      consentStatus: "consented",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    mockGatewayFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: notificationsData }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createUdpDomainClient({ region, baseUrl, pairwiseId });
    const result = await getNotificationPreferences(client);

    expect(result).toEqual({
      notifications: notificationsData,
    });
  });

  it("returns null when client returns no data (404)", async () => {
    mockGatewayFetch.mockResolvedValue(new Response("", { status: 404 }));

    const client = createUdpDomainClient({ region, baseUrl, pairwiseId });
    const result = await getNotificationPreferences(client);

    expect(result).toBeNull();
  });
});
