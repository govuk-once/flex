import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUdpRemoteClient, type UdpRemoteClientConfig } from "./client";

const BASE_CONFIG: UdpRemoteClientConfig = {
  region: "eu-west-2",
  apiUrl: "https://api.example.com/gateways/udp",
  consumerRoleArn: "arn:aws:iam::123456789:role/test-consumer",
};

const mockSigv4Fetch = vi.fn();

vi.mock("@flex/utils", () => ({
  sigv4FetchWithCredentials: (opts: Record<string, unknown>) =>
    mockSigv4Fetch(opts) as Promise<Response>,
}));

describe("createUdpRemoteClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSigv4Fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          consentStatus: "consented",
          updatedAt: "2025-01-01T00:00:00Z",
        }),
        { status: 200 },
      ),
    );
  });

  describe("path building", () => {
    it("prefixes paths with stage from apiUrl when pathname has segments", async () => {
      const client = createUdpRemoteClient(BASE_CONFIG);
      await client.getNotifications("user-123");

      expect(mockSigv4Fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: "https://api.example.com/gateways/udp",
          path: "/gateways/udp/v1/notifications",
          method: "GET",
        }),
      );
    });

    it("handles apiUrl with trailing slash", async () => {
      const client = createUdpRemoteClient({
        ...BASE_CONFIG,
        apiUrl: "https://api.example.com/gateways/udp/",
      });
      await client.getNotifications("user-123");

      expect(mockSigv4Fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/gateways/udp/v1/notifications",
        }),
      );
    });

    it("builds root path when apiUrl has no pathname", async () => {
      const client = createUdpRemoteClient({
        ...BASE_CONFIG,
        apiUrl: "https://api.example.com",
      });
      await client.postUser({ notificationId: "n1", appId: "a1" });

      expect(mockSigv4Fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/v1/user",
        }),
      );
    });

    it("strips leading slash from suffix in path()", async () => {
      const client = createUdpRemoteClient(BASE_CONFIG);
      await client.getNotifications("user-456");

      expect(mockSigv4Fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/gateways/udp/v1/notifications",
        }),
      );
    });
  });

  describe("method wiring", () => {
    it("getNotifications passes correct method, path and headers", async () => {
      const client = createUdpRemoteClient(BASE_CONFIG);
      await client.getNotifications("pairwise-abc");

      const callArgs = mockSigv4Fetch.mock.calls[0][0] as {
        method: string;
        path: string;
        headers?: Record<string, string>;
      };
      expect(callArgs.method).toBe("GET");
      expect(callArgs.path).toContain("v1/notifications");
      expect(callArgs.headers).toEqual({
        "requesting-service": "app",
        "requesting-service-user-id": "pairwise-abc",
      });
    });

    it("postNotifications passes body and headers", async () => {
      const client = createUdpRemoteClient(BASE_CONFIG);
      const body = {
        data: { consentStatus: "consented", updatedAt: "2025-01-01T00:00:00Z" },
      };
      await client.postNotifications(body, "user-xyz");

      expect(mockSigv4Fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          path: expect.stringContaining("v1/notifications") as string,
          body,
          headers: {
            "requesting-service": "app",
            "requesting-service-user-id": "user-xyz",
          },
        }),
      );
    });

    it("postUser passes body without requesting-service headers", async () => {
      const client = createUdpRemoteClient(BASE_CONFIG);
      const body = { notificationId: "notif-1", appId: "app-1" };
      await client.postUser(body);

      expect(mockSigv4Fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          path: expect.stringContaining("v1/user") as string,
          body,
        }),
      );
      expect(
        (mockSigv4Fetch.mock.calls[0][0] as { headers?: unknown }).headers,
      ).toBeUndefined();
    });

    it("call forwards options to fetchRemote", async () => {
      const client = createUdpRemoteClient(BASE_CONFIG);
      await client.call({
        method: "GET",
        path: "/custom/path",
        headers: { "X-Custom": "value" },
      });

      expect(mockSigv4Fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          path: "/custom/path",
          headers: { "X-Custom": "value" },
        }),
      );
    });

    it("passes config to sigv4FetchWithCredentials", async () => {
      const config: UdpRemoteClientConfig = {
        ...BASE_CONFIG,
        externalId: "external-123",
      };
      const client = createUdpRemoteClient(config);
      await client.getNotifications("user");

      expect(mockSigv4Fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          region: "eu-west-2",
          baseUrl: "https://api.example.com/gateways/udp",
          roleArn: "arn:aws:iam::123456789:role/test-consumer",
          externalId: "external-123",
        }),
      );
    });
  });

  describe("validateResponse (via typed methods)", () => {
    it("returns ok with parsed data when response is valid and matches schema", async () => {
      mockSigv4Fetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              consentStatus: "consented",
              updatedAt: "2025-01-01T00:00:00Z",
            },
          }),
          { status: 200 },
        ),
      );

      const client = createUdpRemoteClient(BASE_CONFIG);
      const result = await client.getNotifications("user");

      expect(result).toEqual({
        ok: true,
        status: 200,
        data: {
          data: {
            consentStatus: "consented",
            updatedAt: "2025-01-01T00:00:00Z",
          },
        },
      });
    });

    it("accepts consent data in flat format (schema union)", async () => {
      mockSigv4Fetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            consentStatus: "unknown",
            updatedAt: "2025-01-01T00:00:00Z",
          }),
          { status: 200 },
        ),
      );

      const client = createUdpRemoteClient(BASE_CONFIG);
      const result = await client.getNotifications("user");

      expect(result).toEqual({
        ok: true,
        status: 200,
        data: {
          consentStatus: "unknown",
          updatedAt: "2025-01-01T00:00:00Z",
        },
      });
    });

    it("postNotifications accept simple success message response", async () => {
      mockSigv4Fetch.mockResolvedValue(
        new Response(JSON.stringify({ message: "Entity saved successfully" }), {
          status: 200,
        }),
      );

      const client = createUdpRemoteClient(BASE_CONFIG);
      const result = await client.postNotifications(
        {
          data: {
            consentStatus: "consented",
            updatedAt: "2025-01-01T00:00:00Z",
          },
        },
        "user-1",
      );

      expect(result).toEqual({
        ok: true,
        status: 200,
        data: { message: "Entity saved successfully" },
      });
    });

    it("returns error with REMOTE_SCHEMA_MISMATCH when response is invalid JSON", async () => {
      mockSigv4Fetch.mockResolvedValue(
        new Response("not valid json {{{", { status: 200 }),
      );

      const client = createUdpRemoteClient(BASE_CONFIG);
      const result = await client.getNotifications("user");

      expect(result).toEqual({
        ok: false,
        status: 422,
        error: {
          status: 422,
          message: "Invalid JSON response",
          code: "REMOTE_SCHEMA_MISMATCH",
        },
      });
    });

    it("returns error with REMOTE_SCHEMA_MISMATCH when response fails schema validation", async () => {
      mockSigv4Fetch.mockResolvedValue(
        new Response(
          JSON.stringify({ wrong: "shape", missing: "required fields" }),
          { status: 200 },
        ),
      );

      const client = createUdpRemoteClient(BASE_CONFIG);
      const result = await client.getNotifications("user");

      expect(result).toEqual({
        ok: false,
        status: 422,
        error: {
          status: 422,
          message: "Remote API contract violation",
          code: "REMOTE_SCHEMA_MISMATCH",
        },
      });
    });

    it("returns error with status and message when response is not ok (4xx)", async () => {
      mockSigv4Fetch.mockResolvedValue(
        new Response(
          JSON.stringify({ message: "Not found", code: "NOT_FOUND" }),
          { status: 404 },
        ),
      );

      const client = createUdpRemoteClient(BASE_CONFIG);
      const result = await client.getNotifications("user");

      expect(result).toEqual({
        ok: false,
        status: 404,
        error: {
          status: 404,
          message: "Not found",
          code: "NOT_FOUND",
        },
      });
    });

    it("returns error with default message when non-ok response has no message", async () => {
      mockSigv4Fetch.mockResolvedValue(
        new Response(JSON.stringify({}), { status: 500 }),
      );

      const client = createUdpRemoteClient(BASE_CONFIG);
      const result = await client.getNotifications("user");

      expect(result).toEqual({
        ok: false,
        status: 500,
        error: {
          status: 500,
          message: "Request failed",
        },
      });
    });

    it("postUser returns ok with RemoteCreateUserResponse shape", async () => {
      mockSigv4Fetch.mockResolvedValue(
        new Response(
          JSON.stringify({ id: "uid-1", notificationId: "notif-1" }),
          { status: 201 },
        ),
      );

      const client = createUdpRemoteClient(BASE_CONFIG);
      const result = await client.postUser({
        notificationId: "notif-1",
        appId: "app-1",
      });

      expect(result).toEqual({
        ok: true,
        status: 201,
        data: { id: "uid-1", notificationId: "notif-1" },
      });
    });

    it("postUser accepts null response body", async () => {
      mockSigv4Fetch.mockResolvedValue(new Response("null", { status: 201 }));

      const client = createUdpRemoteClient(BASE_CONFIG);
      const result = await client.postUser({
        notificationId: "notif-1",
        appId: "app-1",
      });

      expect(result).toEqual({
        ok: true,
        status: 201,
        data: null,
      });
    });

    it("treats empty response body as undefined for JSON parse", async () => {
      mockSigv4Fetch.mockResolvedValue(new Response("", { status: 200 }));

      const client = createUdpRemoteClient(BASE_CONFIG);
      const result = await client.postUser({
        notificationId: "n",
        appId: "a",
      });

      expect(result).toEqual({
        ok: true,
        status: 200,
        data: undefined,
      });
    });
  });
});
