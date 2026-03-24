import { it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";

import { execute } from "./executor";

vi.mock("@flex/logging");

const remoteClient = {
  authentication: {
    get: vi.fn(),
  },
  licence: {
    get: vi.fn(),
  },
  customer: {
    get: vi.fn(),
  },
};

describe("DVLA Executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.for([
    {
      method: "GET",
      path: "/v1/authenticate",
      operation: "authenticate",
      configureRemoteClient: () => {
        remoteClient.authentication.get.mockResolvedValue({
          ok: true,
          status: 200,
          data: { "id-token": "test-jwt-token" },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.authentication.get).toHaveBeenCalled();
      },
    },
    {
      method: "GET",
      path: "/v1/licence/SMITH999999AB9YZ",
      operation: "getLicence",
      headers: { auth: "Bearer jwt-123" },
      configureRemoteClient: () => {
        remoteClient.licence.get.mockResolvedValue({
          ok: true,
          status: 200,
          data: { driver: { lastName: "DOE" }, licence: { status: "Valid" } },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.licence.get).toHaveBeenCalledWith(
          "SMITH999999AB9YZ",
          "Bearer jwt-123",
        );
      },
    },
    {
      method: "GET",
      path: "/v1/customer/linking-id-456",
      operation: "getCustomer",
      headers: { auth: "Bearer jwt-123" },
      configureRemoteClient: () => {
        remoteClient.customer.get.mockResolvedValue({
          ok: true,
          status: 200,
          data: { linkingId: "linking-id-456", customer: {} },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.customer.get).toHaveBeenCalledWith(
          "linking-id-456",
          "Bearer jwt-123",
        );
      },
    },
  ])(
    "should resolve request for $method $path to $operation",
    async (
      { method, path, headers, configureRemoteClient, assertRemoteClientCall },
      { privateGatewayEvent },
    ) => {
      configureRemoteClient();

      const event = privateGatewayEvent.create({
        httpMethod: method,
        path,
        headers,
      });

      const result = await execute(event, remoteClient);

      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
      assertRemoteClientCall();
    },
  );

  describe("Error scenarios", () => {
    it("throws 404 when route is not registered", async ({
      privateGatewayEvent,
    }) => {
      const event = privateGatewayEvent.get("/v1/unknown-route");

      await expect(execute(event, remoteClient)).rejects.toMatchObject({
        statusCode: 404,
        message: "Route not found",
      });
    });

    it("throws 400 when auth header is missing for protected routes", async ({
      privateGatewayEvent,
    }) => {
      const event = privateGatewayEvent.get("/v1/licence/12345");

      await expect(execute(event, remoteClient)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("returns error result when remote client returns failure", async ({
      privateGatewayEvent,
    }) => {
      remoteClient.authentication.get.mockResolvedValue({
        ok: false,
        error: {
          message: "Unauthorized",
        },
      });

      const event = privateGatewayEvent.get("/v1/authenticate");
      const result = await execute(event, remoteClient);

      expect(result.ok).toBe(false);
    });
  });
});
