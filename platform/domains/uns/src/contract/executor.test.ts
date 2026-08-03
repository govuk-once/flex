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
  groups: {
    get: vi.fn(),
    post: vi.fn(),
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
    {
      method: "GET",
      path: "/v1/groups",
      operation: "getGroups",
      queryStringParameters: { pushID: "push-123" },
      configureRemoteClient: () => {
        remoteClient.groups.get.mockResolvedValue({
          ok: true,
          status: 200,
          data: [
            {
              Namespace: "travel",
              Group: "france",
            },
          ],
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.groups.get).toHaveBeenCalledWith("push-123");
      },
    },
    {
      method: "POST",
      path: "/v1/groups",
      operation: "postGroups",
      queryStringParameters: { pushID: "push-123" },
      body: [
        {
          Namespace: "travel",
          Group: "france",
          Action: "JOIN",
        },
        {
          Namespace: "travel",
          Group: "spain",
          Subgroup: "instant",
          Action: "LEAVE",
        },
      ],
      configureRemoteClient: () => {
        remoteClient.groups.post.mockResolvedValue({
          ok: true,
          status: 200,
          data: [
            {
              Namespace: "travel",
              Group: "france",
            },
          ],
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.groups.post).toHaveBeenCalledWith("push-123", [
          {
            Namespace: "travel",
            Group: "france",
            Action: "JOIN",
          },
          {
            Namespace: "travel",
            Group: "spain",
            Subgroup: "instant",
            Action: "LEAVE",
          },
        ]);
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

    it("throws 404 when route is not registered", async ({
      privateGatewayEvent,
    }) => {
      const event = privateGatewayEvent.get("/v1/unknown-route");

      await expect(execute(event, remoteClient)).rejects.toMatchObject({
        statusCode: 404,
        message: "Route not found",
      });
    });

    it("throws 400 when PATCH body is missing", async ({
      privateGatewayEvent,
    }) => {
      const event = privateGatewayEvent.create({
        httpMethod: "PATCH",
        path: "/v1/notifications/notif-123/status",
        queryStringParameters: { externalUserID: "user-123" },
        body: null,
      });

      await expect(execute(event, remoteClient)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("throws 400 when PATCH body is invalid JSON", async ({
      privateGatewayEvent,
    }) => {
      const event = privateGatewayEvent.create({
        httpMethod: "PATCH",
        path: "/v1/notifications/notif-123/status",
        queryStringParameters: { externalUserID: "user-123" },
        body: "not-valid-json{",
      });

      await expect(execute(event, remoteClient)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("throws 400 when PATCH body fails schema validation", async ({
      privateGatewayEvent,
    }) => {
      const event = privateGatewayEvent.create({
        httpMethod: "PATCH",
        path: "/v1/notifications/notif-123/status",
        queryStringParameters: { externalUserID: "user-123" },
        body: JSON.stringify({ Status: "INVALID_STATUS" }),
      });

      await expect(execute(event, remoteClient)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("throws 400 when pushID is missing for GET groups", async ({
      privateGatewayEvent,
    }) => {
      const event = privateGatewayEvent.get("/v1/groups");

      await expect(execute(event, remoteClient)).rejects.toMatchObject({
        statusCode: 400,
        message: "Missing or invalid pushID query parameter",
      });

      expect(remoteClient.groups.get).not.toHaveBeenCalled();
    });

    it("throws 400 when pushID is missing for POST groups", async ({
      privateGatewayEvent,
    }) => {
      const event = privateGatewayEvent.create({
        httpMethod: "POST",
        path: "/v1/groups",
        queryStringParameters: null,
        body: JSON.stringify([
          {
            Namespace: "travel",
            Group: "france",
            Action: "JOIN",
          },
        ]),
      });

      await expect(execute(event, remoteClient)).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(remoteClient.groups.post).not.toHaveBeenCalled();
    });

    it("throws 400 when POST groups body is missing", async ({
      privateGatewayEvent,
    }) => {
      const event = privateGatewayEvent.create({
        httpMethod: "POST",
        path: "/v1/groups",
        queryStringParameters: { pushID: "push-123" },
        body: null,
      });

      await expect(execute(event, remoteClient)).rejects.toMatchObject({
        statusCode: 400,
        message: "Request body is missing",
      });

      expect(remoteClient.groups.post).not.toHaveBeenCalled();
    });

    it("throws 400 when POST groups body contains invalid JSON", async ({
      privateGatewayEvent,
    }) => {
      const event = privateGatewayEvent.create({
        httpMethod: "POST",
        path: "/v1/groups",
        queryStringParameters: { pushID: "push-123" },
        body: "not-valid-json{",
      });

      await expect(execute(event, remoteClient)).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid JSON format in body",
      });

      expect(remoteClient.groups.post).not.toHaveBeenCalled();
    });

    it("throws 400 when POST groups action is invalid", async ({
      privateGatewayEvent,
    }) => {
      const event = privateGatewayEvent.create({
        httpMethod: "POST",
        path: "/v1/groups",
        queryStringParameters: { pushID: "push-123" },
        body: JSON.stringify([
          {
            Namespace: "travel",
            Group: "france",
            Action: "SUBSCRIBE",
          },
        ]),
      });

      await expect(execute(event, remoteClient)).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(remoteClient.groups.post).not.toHaveBeenCalled();
    });

    it("throws 400 when POST groups body is not an array", async ({
      privateGatewayEvent,
    }) => {
      const event = privateGatewayEvent.create({
        httpMethod: "POST",
        path: "/v1/groups",
        queryStringParameters: { pushID: "push-123" },
        body: JSON.stringify({
          Namespace: "travel",
          Group: "france",
          Action: "JOIN",
        }),
      });

      await expect(execute(event, remoteClient)).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(remoteClient.groups.post).not.toHaveBeenCalled();
    });
  });
});
