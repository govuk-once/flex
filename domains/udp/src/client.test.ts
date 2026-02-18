import createHttpError from "http-errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUdpDomainClient } from "./client";
import { CONSENT_STATUS } from "./schemas";

const mockGatewayFetch = vi.fn();
const mockDomainFetch = vi.fn();

vi.mock("@flex/flex-fetch", () => ({
  createSigv4Fetch:
    (baseConfig: { headers?: Record<string, string> }) =>
    async (request: { method: string; path: string; body?: unknown }) =>
      mockGatewayFetch({ baseConfig, request }) as Promise<Response>,
  sigv4Fetch: (opts: { method: string; path: string; body?: unknown }) =>
    mockDomainFetch(opts) as Promise<Response>,
  flexFetch: vi.fn(),
}));

describe("createUdpDomainClient", () => {
  const baseUrl = new URL("https://execute-api.eu-west-2.amazonaws.com");
  const region = "eu-west-2";
  const pairwiseId = "test-pairwise-id";
  const jsonHeaders = { "Content-Type": "application/json" };

  beforeEach(() => {
    mockGatewayFetch.mockReset();
    mockDomainFetch.mockReset();
  });

  describe("gateway.getNotifications (fetchConsent)", () => {
    it("returns { response, data } when GET returns 200 with wrapped consent", async () => {
      const notificationsData = {
        consentStatus: "consented",
        updatedAt: "2025-01-01T00:00:00Z",
      };
      mockGatewayFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: notificationsData }), {
          status: 200,
          headers: jsonHeaders,
        }),
      );

      const client = createUdpDomainClient({ region, baseUrl, pairwiseId });
      const result = await client.gateway.getNotifications();

      expect(result.response.status).toBe(200);
      expect(result.data).toEqual(notificationsData);
      expect(mockGatewayFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest expect.objectContaining
          request: expect.objectContaining({
            method: "GET",
            path: "notifications",
          }),
        }),
      );
    });

    it("returns { response, data } when GET returns 200 with flat consent", async () => {
      const notificationsData = {
        consentStatus: "not_consented",
        updatedAt: "2025-01-15T10:00:00Z",
      };
      mockGatewayFetch.mockResolvedValue(
        new Response(JSON.stringify(notificationsData), {
          status: 200,
          headers: jsonHeaders,
        }),
      );

      const client = createUdpDomainClient({ region, baseUrl, pairwiseId });
      const result = await client.gateway.getNotifications();

      expect(result.response.status).toBe(200);
      expect(result.data).toEqual(notificationsData);
    });

    it("returns { response, data: null } when GET returns 404", async () => {
      mockGatewayFetch.mockResolvedValue(new Response("", { status: 404 }));

      const client = createUdpDomainClient({ region, baseUrl, pairwiseId });
      const result = await client.gateway.getNotifications();

      expect(result.response.status).toBe(404);
      expect(result.data).toBeNull();
    });

    it("throws BadGateway when GET returns 5xx", async () => {
      mockGatewayFetch.mockResolvedValue(
        new Response(JSON.stringify({ message: "Internal Server Error" }), {
          status: 500,
          headers: jsonHeaders,
        }),
      );

      const client = createUdpDomainClient({ region, baseUrl, pairwiseId });

      await expect(client.gateway.getNotifications()).rejects.toThrow(
        createHttpError.BadGateway,
      );
    });

    it("sends requesting-service and requesting-service-user-id headers", async () => {
      const customPairwiseId = "custom-user-456";
      const consentData = {
        consentStatus: "unknown",
        updatedAt: "2025-01-01",
      };
      mockGatewayFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: consentData }), {
          status: 200,
          headers: jsonHeaders,
        }),
      );

      const client = createUdpDomainClient({
        region,
        baseUrl,
        pairwiseId: customPairwiseId,
      });
      await client.gateway.getNotifications();

      expect(mockGatewayFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest expect.objectContaining
          baseConfig: expect.objectContaining({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest expect.objectContaining
            headers: expect.objectContaining({
              "requesting-service": "app",
              "requesting-service-user-id": customPairwiseId,
            }),
          }),
        }),
      );
    });
  });

  describe("gateway.postNotifications", () => {
    it("posts consent status with correct method, path, and body", async () => {
      mockGatewayFetch.mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200, headers: jsonHeaders }),
      );

      const client = createUdpDomainClient({ region, baseUrl, pairwiseId });
      const body = {
        data: {
          consentStatus: CONSENT_STATUS.CONSENTED,
          updatedAt: "2025-01-15T10:00:00Z",
        },
      };
      await client.gateway.postNotifications(body);

      expect(mockGatewayFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest expect.objectContaining
          request: expect.objectContaining({
            method: "POST",
            path: "notifications",
            body,
          }),
        }),
      );
    });
  });

  describe("gateway.createUser", () => {
    it("posts user creation with correct method, path, and body", async () => {
      mockGatewayFetch.mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 201,
          headers: jsonHeaders,
        }),
      );

      const client = createUdpDomainClient({ region, baseUrl, pairwiseId });
      const body = { notificationId: "test-notification-id" };
      await client.gateway.createUser(body);

      expect(mockGatewayFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest expect.objectContaining
          request: expect.objectContaining({
            method: "POST",
            path: "user",
            body: {
              notificationId: "test-notification-id",
              appId: pairwiseId,
            },
          }),
        }),
      );
    });
  });

  describe("domain.createUser", () => {
    it("calls sigv4Fetch with correct method, path, body (notificationId, appId)", async () => {
      mockDomainFetch.mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 201,
          headers: jsonHeaders,
        }),
      );

      const client = createUdpDomainClient({ region, baseUrl, pairwiseId });
      await client.domain.createUser({
        notificationId: "test-notification-id",
      });

      expect(mockDomainFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          path: "user",
          body: {
            notificationId: "test-notification-id",
            appId: pairwiseId,
          },
        }),
      );
    });
  });
});
