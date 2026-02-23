import { it } from "@flex/testing";
import { describe, expect, vi } from "vitest";

import { resolveRequest } from "./resolver";

vi.mock("@flex/logging", () => ({
  getLogger: vi.fn().mockReturnValue({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("resolver", () => {
  it.for([
    {
      method: "POST",
      path: "/v1/user",
      operation: "createUser",
      body: { appId: "1234", notificationId: "5678" },
    },
    {
      method: "POST",
      path: "/v1/notifications",
      operation: "updateNotifications",
      headers: { "requesting-service-user-id": "123" },
      body: { preferences: { notifications: { consentStatus: "accepted" } } },
    },
    {
      method: "GET",
      path: "/v1/notifications",
      operation: "getNotifications",
      headers: { "requesting-service-user-id": "123" },
    },
  ])(
    "should resolve request for $method $path to $operation",
    async (
      { method, path, operation, headers, body },
      { privateGatewayEvent },
    ) => {
      const event = privateGatewayEvent.create({
        httpMethod: method,
        path,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const request = await resolveRequest(event);
      expect(request).toBeDefined();
      expect(request.operation).toEqual(operation);
    },
  );

  it("throws 404 when route is not registered", async ({
    privateGatewayEvent,
  }) => {
    const event = privateGatewayEvent.get("/v1/unknown");

    await expect(resolveRequest(event)).rejects.toMatchObject({
      statusCode: 404,
      message: "Route not found",
    });
  });

  it("throws 400 when required header is missing", async ({
    privateGatewayEvent,
  }) => {
    const event = privateGatewayEvent.get("/v1/notifications");

    await expect(resolveRequest(event)).rejects.toMatchObject({
      statusCode: 400,
      message: "Missing requesting-service-user-id header",
    });
  });

  it("throws 400 for invalid JSON request body", async ({
    privateGatewayEvent,
  }) => {
    const event = privateGatewayEvent.create({
      httpMethod: "POST",
      path: "/v1/user",
      body: "{invalid-json",
    });

    await expect(resolveRequest(event)).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid JSON body",
    });
  });

  it.for([
    {
      method: "POST",
      path: "/v1/user",
      operation: "createUser",
      body: { appId: null, notificationId: "5678" },
    },
    {
      method: "POST",
      path: "/v1/notifications",
      operation: "updateNotifications",
      headers: { "requesting-service-user-id": "123" },
      body: { preferences: undefined },
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
      await expect(resolveRequest(event)).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid request body",
      });
    },
  );
});
