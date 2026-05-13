import { it } from "@flex/testing";
import status from "http-status";
import nock from "nock";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./get";

describe("GET /v1/driver-summary", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const testAuthToken = "test-id-token";
  const testLinkingId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.stubEnv("flexDvlaTestUser", testLinkingId);
  });

  const mockUdpSuccess = () =>
    api.get("/domains/udp/v1/identity/dvla").reply(200, {
      serviceId: testLinkingId,
      serviceName: "dvla",
    });

  const mockAuthSuccess = () =>
    api.get("/gateways/dvla/v1/authenticate").reply(200, {
      "id-token": testAuthToken,
      apiKeyExpiry: "2030-01-01T00:00:00Z", // pragma: allowlist secret
      passwordExpiry: "2030-01-01T00:00:00Z", // pragma: allowlist secret
    });

  it("returns 200 and driver summary data on success", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    mockUdpSuccess();
    mockAuthSuccess();

    const mockDriverSummaryData = {
      linkingId: testLinkingId,
      hasErrors: false,
      driverViewResponse: {
        driver: {
          drivingLicenceNumber: "SMITH999999AB9YZ",
          lastName: "SMITH",
          firstNames: "JANE",
        },
        licence: {
          type: "Full",
          status: "Valid",
        },
      },
    };

    api
      .get(`/gateways/dvla/v1/driver-summary/${testLinkingId}`)
      .matchHeader("auth", testAuthToken)
      .reply(status.OK, mockDriverSummaryData);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({}),
      context.create(),
    );

    expect(result.statusCode).toBe(status.OK);
    expect(JSON.parse(result.body)).toStrictEqual(mockDriverSummaryData);
  });

  describe("Error scenarios", () => {
    it("returns 502 if DVLA authentication fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      api
        .get("/gateways/dvla/v1/authenticate")
        .reply(status.INTERNAL_SERVER_ERROR);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(status.BAD_GATEWAY);
    });

    it("returns 502 if driver-summary integration call fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      mockAuthSuccess();

      api
        .get(`/gateways/dvla/v1/driver-summary/${testLinkingId}`)
        .reply(status.INTERNAL_SERVER_ERROR, {
          message: "Internal Server Error",
        });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(status.BAD_GATEWAY);
    });

    it("returns 404 if the user linking ID is missing from UDP", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api.get("/domains/udp/v1/identity/dvla").reply(status.NOT_FOUND);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(status.NOT_FOUND);
    });
  });
});
