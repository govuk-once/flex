import { it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";

import { execute } from "./executor";

vi.mock("@flex/logging");

const remoteClient = {
  user: {
    create: vi.fn(),
  },
  notifications: {
    get: vi.fn(),
    update: vi.fn(),
  },
  serviceLink: {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
};

describe("Executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.for([
    {
      method: "POST",
      path: "/v1/users",
      operation: "createUser",
      body: { userId: "456", notificationId: "5678" },
      configureRemoteClient: () => {
        remoteClient.user.create.mockResolvedValue({
          ok: true,
          status: 200,
          data: { message: "created" },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.user.create).toHaveBeenCalledWith({
          appId: "456",
          notificationId: "5678",
        });
      },
    },
    {
      method: "POST",
      path: "/v1/notifications",
      operation: "updateNotifications",
      headers: { "requesting-service-user-id": "123" },
      body: { consentStatus: "accepted", notificationId: "abc" },
      configureRemoteClient: () => {
        remoteClient.notifications.update.mockResolvedValue({
          ok: true,
          status: 200,
          data: {
            data: { consentStatus: "accepted", notificationId: "abc" },
          },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.notifications.update).toHaveBeenCalledWith(
          {
            data: { consentStatus: "accepted", notificationId: "abc" },
            requestingServiceUserId: "123",
          },
          "123",
        );
      },
    },
    {
      method: "GET",
      path: "/v1/notifications",
      operation: "getNotifications",
      headers: { "requesting-service-user-id": "123" },
      body: undefined,
      configureRemoteClient: () => {
        remoteClient.notifications.get.mockResolvedValue({
          ok: true,
          status: 200,
          data: {
            data: { consentStatus: "accepted", notificationId: "abc" },
          },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.notifications.get).toHaveBeenCalledWith("123");
      },
    },
    {
      method: "POST",
      path: "/v1/identity/my-service/user-abc-123",
      operation: "createServiceLink",
      body: { appId: "pairwise-999" },
      configureRemoteClient: () => {
        remoteClient.serviceLink.create.mockResolvedValue({
          ok: true,
          status: 201,
          data: undefined,
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.serviceLink.create).toHaveBeenCalledWith(
          "my-service",
          "user-abc-123",
          { appId: "pairwise-999" },
        );
      },
    },
    {
      method: "DELETE",
      path: "/v1/identity/my-service/pairwise-999",
      operation: "deleteIdentityLink",
      headers: {
        "User-Id": "pairwise-999",
      },
      configureRemoteClient: () => {
        remoteClient.serviceLink.delete.mockResolvedValue({
          ok: true,
          status: 204,
          data: undefined,
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.serviceLink.delete).toHaveBeenCalledWith(
          "my-service",
          "pairwise-999",
        );
      },
    },
    {
      method: "GET",
      path: "/v1/identity/my-awesome-service",
      operation: "getIdentityLink",
      headers: {
        "User-Id": "user-12345",
      },
      configureRemoteClient: () => {
        remoteClient.serviceLink.get.mockResolvedValue({
          ok: true,
          status: 200,
          data: { identity: "linked-account-data" },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.serviceLink.get).toHaveBeenCalledWith(
          "my-awesome-service",
          "user-12345",
        );
      },
    },
  ])(
    "should resolve request for $method $path to $operation",
    async (
      {
        method,
        path,
        headers,
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
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await execute(event, remoteClient);
      expect(result).toBeDefined();
      assertRemoteClientCall();
    },
  );

  it.for([
    {
      method: "POST",
      path: "/v1/users",
      operation: "createUser",
      body: { userId: null, notificationId: "5678" },
    },
    {
      method: "POST",
      path: "/v1/notifications",
      operation: "updateNotifications",
      headers: { "requesting-service-user-id": "123" },
      body: { consentStatus: "invalid-status" },
    },
    {
      method: "POST",
      path: "/v1/identity/service/id",
      operation: "createServiceLink",
      body: { appId: undefined },
    },
  ])(
    "throws 400 when $method $path $operation body fails schema validation",
    async ({ method, path, headers, body }, { privateGatewayEvent }) => {
      const event = privateGatewayEvent.create({
        httpMethod: method,
        path,
        headers,
        body: JSON.stringify(body),
      });
      await expect(execute(event, remoteClient)).rejects.toMatchObject({
        message: "Bad Request",
      });
    },
  );

  it("throws 404 when route is not registered", async ({
    privateGatewayEvent,
  }) => {
    const event = privateGatewayEvent.get("/v1/unknown");

    await expect(execute(event, remoteClient)).rejects.toMatchObject({
      statusCode: 404,
      message: "Route not found",
    });
  });

  it("throws 404 when path normalizes to root", async ({
    privateGatewayEvent,
  }) => {
    const event = privateGatewayEvent.get("/gateways/udp");

    await expect(execute(event, remoteClient)).rejects.toMatchObject({
      statusCode: 404,
      message: "Route not found",
    });
  });

  it("throws 400 when required header is missing", async ({
    privateGatewayEvent,
  }) => {
    const event = privateGatewayEvent.get("/v1/notifications");

    await expect(execute(event, remoteClient)).rejects.toMatchObject({
      statusCode: 400,
      message: "Missing requesting-service-user-id header",
    });
  });

  it("throws 400 for invalid JSON request body", async ({
    privateGatewayEvent,
  }) => {
    const event = privateGatewayEvent.create({
      httpMethod: "POST",
      path: "/v1/users",
      body: "{invalid-json",
    });

    await expect(execute(event, remoteClient)).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid JSON body",
    });
  });

  it.for([
    {
      method: "GET",
      path: "/v1/identity/my-service",
      operation: "getIdentityLink",
      headers: {},
      body: undefined,
    },
    {
      method: "GET",
      path: "/v1/identity/my-service",
      operation: "getIdentityLink",
      headers: { "User-Id": "" },
      body: undefined,
    },
  ])(
    "throws 400 when $headers validation fails",
    async ({ method, path, headers }, { privateGatewayEvent }) => {
      const event = privateGatewayEvent.create({
        httpMethod: method,
        path,
        headers,
      });

      await expect(execute(event, remoteClient)).rejects.toMatchObject({
        statusCode: 400,
      });
    },
  );
});
