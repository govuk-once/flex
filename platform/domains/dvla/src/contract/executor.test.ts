import { it } from "@flex/testing";
import { APIGatewayProxyEvent } from "aws-lambda";
import { beforeEach, describe, expect, vi } from "vitest";

import { execute } from "./executor";
import { ROUTE_CONTRACTS } from "./route";

vi.mock("@flex/logging");

const remoteClient = {
  authentication: {
    get: vi.fn(),
  },
  wellKnownJwk: {
    get: vi.fn(),
  },
  customerVehicles: {
    get: vi.fn(),
  },
  customerVehicle: {
    get: vi.fn(),
  },
  customerDrivingLicence: {
    get: vi.fn(),
  },
  notification: {
    post: vi.fn(),
  },
  vehicle: {
    get: vi.fn(),
  },
  cancelShareCode: {
    post: vi.fn(),
  },
  shareCode: {
    post: vi.fn(),
  },
  unlink: {
    post: vi.fn(),
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
      path: "/v1/well-known-jwks",
      operation: "getWellKnownJwk",
      configureRemoteClient: () => {
        remoteClient.wellKnownJwk.get.mockResolvedValue({
          ok: true,
          status: 200,
          data: {
            keys: [
              {
                kty: "RSA",
                use: "sig",
                alg: "PS256",
                kid: "alias/nonprod-govuk-app-jwt-signing-key",
                n: "mock-n",
                e: "AQAB",
              },
            ],
          },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.wellKnownJwk.get).toHaveBeenCalled();
      },
    },
    {
      method: "GET",
      path: "/v1/customer/vehicles",
      operation: "getCustomerVehicles",
      headers: { auth: "Bearer jwt-123" },
      queryParams: { linkingId: "linking-id-456" },
      configureRemoteClient: () => {
        remoteClient.customerVehicles.get.mockResolvedValue({
          ok: true,
          status: 200,
          data: { customerVehicles: [] },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.customerVehicles.get).toHaveBeenCalledWith(
          "linking-id-456",
          "Bearer jwt-123",
        );
      },
    },
    {
      method: "GET",
      path: "/v1/customer/vehicle/veh-789",
      operation: "getCustomerVehicle",
      headers: { auth: "Bearer jwt-123" },
      queryParams: { linkingId: "linking-id-456" },
      configureRemoteClient: () => {
        remoteClient.customerVehicle.get.mockResolvedValue({
          ok: true,
          status: 200,
          data: { customerVehicleDetails: {} },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.customerVehicle.get).toHaveBeenCalledWith(
          "linking-id-456",
          "Bearer jwt-123",
          "veh-789",
        );
      },
    },
    {
      method: "GET",
      path: "/v1/customer/licence",
      operation: "getCustomerLicence",
      headers: { auth: "Bearer jwt-123" },
      queryParams: { linkingId: "linking-id-456" },
      configureRemoteClient: () => {
        remoteClient.customerDrivingLicence.get.mockResolvedValue({
          ok: true,
          status: 200,
          data: { driver: {}, licence: {} },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.customerDrivingLicence.get).toHaveBeenCalledWith(
          "linking-id-456",
          "Bearer jwt-123",
        );
      },
    },
    {
      method: "POST",
      path: "/v1/test-notification/test-id-123",
      operation: "postNotification",
      headers: { auth: "Bearer jwt-123" },
      configureRemoteClient: () => {
        remoteClient.notification.post.mockResolvedValue({
          ok: true,
          status: 202,
          data: undefined,
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.notification.post).toHaveBeenCalledWith(
          "test-id-123",
          "Bearer jwt-123",
        );
      },
    },
    {
      method: "GET",
      path: "/v1/vehicle-enquiry/AA11ABC",
      operation: "getVehicle",
      headers: { auth: "Bearer jwt-123" },
      configureRemoteClient: () => {
        remoteClient.vehicle.get.mockResolvedValue({
          ok: true,
          status: 200,
          data: { registrationNumber: "AA11ABC", make: "FORD" },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.vehicle.get).toHaveBeenCalledWith(
          "AA11ABC",
          "Bearer jwt-123",
        );
      },
    },
    {
      method: "POST",
      path: "/v1/share-code",
      operation: "postShareCode",
      headers: { auth: "Bearer jwt-123" },
      queryParams: { linkingId: "test-id-123" },
      configureRemoteClient: () => {
        remoteClient.shareCode.post.mockResolvedValue({
          ok: true,
          status: 201,
          data: {
            linkingId: "550e8400-e29b-41d4-a716-446655440000",
            shareCode: {
              state: "valid",
              tokenId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
              token: "XWRPTSMK",
              drivingLicenceNumber: "JONES952052J99XYZ",
              driverId: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
              documentReference: "DOC99999",
              created: "2026-05-07T09:00:00Z",
              expiry: "2026-05-28T09:00:00Z",
              cancelled: "2026-05-28T09:00:00Z",
            },
          },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.shareCode.post).toHaveBeenCalledWith(
          "test-id-123",
          "Bearer jwt-123",
        );
      },
    },
    {
      method: "POST",
      path: "/v1/share-code/test-share-123/cancel",
      operation: "postShareCode",
      headers: { auth: "Bearer jwt-123" },
      queryParams: { linkingId: "test-id-123" },
      configureRemoteClient: () => {
        remoteClient.cancelShareCode.post.mockResolvedValue({
          ok: true,
          status: 200,
          data: {
            linkingId: "550e8400-e29b-41d4-a716-446655440000",
            shareCode: {
              state: "cancelled",
              tokenId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
              token: "B2CDFGHJ",
              drivingLicenceNumber: "SMITH952052S99ABC",
              driverId: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
              documentReference: "REF12345",
              created: "2026-05-01T10:00:00Z",
              expiry: "2026-05-22T10:00:00Z",
              cancelled: "2026-05-07T11:00:00Z",
            },
          },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.cancelShareCode.post).toHaveBeenCalledWith(
          "test-id-123",
          "Bearer jwt-123",
          "test-share-123",
        );
      },
    },
    {
      method: "POST",
      path: "/v1/unlink-user/service-123-abc",
      operation: "postUnlinkUser",
      headers: { auth: "Bearer jwt-123" },
      configureRemoteClient: () => {
        remoteClient.unlink.post.mockResolvedValue({
          ok: true,
          status: 200,
          data: { success: true },
        });
      },
      assertRemoteClientCall: () => {
        expect(remoteClient.unlink.post).toHaveBeenCalledWith(
          "service-123-abc",
          "Bearer jwt-123",
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
        queryParams,
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
        queryStringParameters: queryParams,
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
      const event = privateGatewayEvent.get("/v1/customer/licence");

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

  describe("ROUTE_CONTRACTS toRemote validation", () => {
    const baseEvent = {
      headers: { auth: "Bearer jwt-123" },
    } as unknown as APIGatewayProxyEvent;

    it("throws 400 when linking-id query parameter is missing", () => {
      expect(() => {
        ROUTE_CONTRACTS["GET:/v1/customer/vehicles"].toRemote(baseEvent);
      }).toThrow("Missing linking-id query parameter");
    });

    it("throws 400 when customer linking id path parameter is missing", () => {
      const event = {
        ...baseEvent,
        path: "/v1/unlink-user",
      } as unknown as APIGatewayProxyEvent;

      expect(() => {
        ROUTE_CONTRACTS["POST:/v1/unlink-user/:id"].toRemote(event);
      }).toThrow("Missing customer linking id in path");
    });

    it("throws 400 when vehicleId path parameter is missing", () => {
      const event = {
        ...baseEvent,
        path: "/v1/customer/vehicle",
        queryStringParameters: { linkingId: "linking-123" },
      } as unknown as APIGatewayProxyEvent;

      expect(() => {
        ROUTE_CONTRACTS["GET:/v1/customer/vehicle/:id"].toRemote(event);
      }).toThrow("Missing vehicleId form path");
    });

    it("throws 400 when registrationNumber path parameter is missing", () => {
      const event = {
        ...baseEvent,
        path: "/v1/vehicle-enquiry",
      } as unknown as APIGatewayProxyEvent;

      expect(() => {
        ROUTE_CONTRACTS["GET:/v1/vehicle-enquiry"].toRemote(event);
      }).toThrow("Missing registrationNumber form path");
    });

    it("throws 400 when shareCodeId path parameter is missing", () => {
      const event = {
        ...baseEvent,
        path: "/v1/share-codes",
        queryStringParameters: { linkingId: "linking-123" },
      } as unknown as APIGatewayProxyEvent;

      expect(() => {
        ROUTE_CONTRACTS["POST:/v1/share-code/:id/cancel"].toRemote(event);
      }).toThrow("Missing shareCodeid in path");
    });
  });
});
