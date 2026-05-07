import { it } from "@flex/testing";
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
      .reply(200, mockShareCodeData);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({}),
      context.create(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(mockShareCodeData);
  });

  describe("Error scenarios", () => {
    it("returns 502 if the internal call to UDP for linking ID fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api.get("/domains/udp/v1/identity/dvla").reply(500);
      mockAuthSuccess();

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(502);
    });

    it("returns 502 if the DVLA authentication service fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      api.get("/gateways/dvla/v1/authenticate").reply(401);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(502);
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
        .reply(500, { message: "DVLA Down" });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(502);
    });

    it("returns 404 if getUserLinkingId returns NOT_FOUND from UDP", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api.get("/domains/udp/v1/identity/dvla").reply(404);
      mockAuthSuccess();

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(404);
    });
  });
});
