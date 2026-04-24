import { it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";

import { execute } from "./executor";

vi.mock("@flex/logging");

const remoteClient = {
  notification: {
    get: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
  notifications: {
    get: vi.fn(),
  },
};

describe("UNS Executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.for([
    {
      method: "GET",
      path: "/v1/notifications",
      operation: "getNotifications",
      queryStringParameters: { externalUserID: "user-123" },
      configureRemoteClient: () => {
        remoteClient.notifications.get.mockResolvedValue({
          ok: true,
          status: 200,
          data: [{ id: "notif-1" }],
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.notifications.get).toHaveBeenCalledWith("user-123");
      },
    },
    {
      method: "GET",
      path: "/v1/notifications/notif-123",
      operation: "getNotificationById",
      queryStringParameters: { externalUserID: "user-123" },
      configureRemoteClient: () => {
        remoteClient.notification.get.mockResolvedValue({
          ok: true,
          status: 200,
          data: { id: "notif-123" },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.notification.get).toHaveBeenCalledWith(
          "user-123",
          "notif-123",
        );
      },
    },
    {
      method: "DELETE",
      path: "/v1/notifications/notif-456",
      operation: "deleteNotificationById",
      queryStringParameters: { externalUserID: "user-123" },
      configureRemoteClient: () => {
        remoteClient.notification.delete.mockResolvedValue({
          ok: true,
          status: 204,
          data: undefined,
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.notification.delete).toHaveBeenCalledWith(
          "user-123",
          "notif-456",
        );
      },
    },
    {
      method: "PATCH",
      path: "/v1/notifications/notif-789/status",
      operation: "patchNotificationById",
      queryStringParameters: { externalUserID: "user-123" },
      body: { Status: "READ" },
      configureRemoteClient: () => {
        remoteClient.notification.patch.mockResolvedValue({
          ok: true,
          status: 202,
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.notification.patch).toHaveBeenCalledWith(
          "user-123",
          "notif-789",
          {
            Status: "READ",
          },
        );
      },
    },
  ])(
    "should resolve request for $method $path to $operation",
    async (
      {
        method,
        path,
        queryStringParameters,
        body,
        configureRemoteClient,
        assertRemoteClientCall,
      },
      { privateGatewayEvent },
    ) => {
      configureRemoteClient();

      const event = privateGatewayEvent.create({
        httpMethod: method,
        path,
        queryStringParameters,
        body: body ? JSON.stringify(body) : null,
      });

      const result = await execute(event, remoteClient);

      expect(result.ok).toBe(true);
      assertRemoteClientCall();
    },
  );

  describe("Validation Scenarios", () => {
    it("throws 400 when externalUserID is missing in query params", async ({
      privateGatewayEvent,
    }) => {
      const event = privateGatewayEvent.get("/v1/notifications");

      await expect(execute(event, remoteClient)).rejects.toMatchObject({
        statusCode: 400,
        message: "Missing or invalid externalUserID query parameter",
      });
    });
  });
});
