import { it } from "@flex/testing";
import status from "http-status";
import nock from "nock";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./get";

describe("GET /v1/share-codes", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const testAuthToken = "test-id-token";
  const testLinkingId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.stubEnv("flexDvlaTestUser", testLinkingId);
  });

  const mockUdpSuccess = () =>
    api.get("/domains/udp/v1/identity/dvla").reply(status.OK, {
      serviceId: testLinkingId,
      serviceName: "dvla",
    });

  const mockAuthSuccess = () =>
    api.get("/gateways/dvla/v1/authenticate").reply(status.OK, {
      "id-token": testAuthToken,
      apiKeyExpiry: "2030-01-01T00:00:00Z", // pragma: allowlist secret
      passwordExpiry: "2030-01-01T00:00:00Z", // pragma: allowlist secret
    });

  const mockShareCodeData = {
    linkingId: testLinkingId,
    shareCodes: [
      {
        state: "valid",
        tokenId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        token: "B2CDFGHJ",
        drivingLicenceNumber: "SMITH952052S99AB",
        driverId: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
        documentReference: "REF12345",
        created: "2026-05-01T10:00:00Z",
        expiry: "2026-05-22T10:00:00Z",
        status: "active",
        cancelled: "2026-05-22T10:00:00Z",
      },
    ],
  };

  it("returns 200 and share codes list on success", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    mockUdpSuccess();
    mockAuthSuccess();

    api
      .get("/gateways/dvla/v1/share-codes")
      .query({ linkingId: testLinkingId })
      .matchHeader("auth", testAuthToken)
      .reply(status.OK, mockShareCodeData);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({}),
      context.create(),
    );

    expect(result.statusCode).toBe(status.OK);
    const { linkingId: _, ...expectedBody } = mockShareCodeData;
    expect(JSON.parse(result.body)).toStrictEqual(expectedBody);
  });

  describe("Error scenarios", () => {
    it("returns 502 if the internal call to UDP for linking ID fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/domains/udp/v1/identity/dvla")
        .reply(status.INTERNAL_SERVER_ERROR);
      mockAuthSuccess();

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(status.BAD_GATEWAY);
    });

    it("returns 502 if the DVLA authentication service fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      api.get("/gateways/dvla/v1/authenticate").reply(status.UNAUTHORIZED);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(status.BAD_GATEWAY);
    });

    it("returns 502 if the final dvlaGetShareCodes integration fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      mockAuthSuccess();

      api
        .get("/gateways/dvla/v1/share-codes")
        .query({ linkingId: testLinkingId })
        .reply(status.INTERNAL_SERVER_ERROR, { message: "DVLA Down" });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(status.BAD_GATEWAY);
    });

    it("returns 404 if getUserLinkingId returns NOT_FOUND from UDP", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api.get("/domains/udp/v1/identity/dvla").reply(status.NOT_FOUND);
      mockAuthSuccess();

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(status.NOT_FOUND);
    });
  });
});
