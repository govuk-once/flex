import { it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";

import { execute } from "./executor";

vi.mock("@flex/logging", () => ({
  getLogger: vi.fn().mockReturnValue({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

const remoteClient = {
  user: {
    create: vi.fn(),
  },
  notifications: {
    get: vi.fn(),
    update: vi.fn(),
  },
};

describe("Executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      path: "/v1/user",
      body: "{invalid-json",
    });

    await expect(execute(event, remoteClient)).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid JSON body",
    });
  });
});
