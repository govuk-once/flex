import { it } from "@flex/testing";
import nock from "nock";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./post";

describe("POST /v1/share-code", () => {
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

  const mockSingleShareCodeData = {
    linkingId: testLinkingId,
    shareCode: {
      state: "valid",
      tokenId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      token: "XWRPTSMK",
      drivingLicenceNumber: "SMITH952052S99AB",
      driverId: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
      documentReference: "DOC99999",
      created: "2026-05-07T09:00:00Z",
      expiry: "2026-05-28T09:00:00Z",
      status: "active",
      cancelled: "2026-05-28T09:00:00Z",
    },
  };

  it("returns 200 and the new share code on success", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    mockUdpSuccess();
    mockAuthSuccess();

    api
      .post("/gateways/dvla/v1/share-code", {})
      .query({ linkingId: testLinkingId })
      .matchHeader("auth", testAuthToken)
      .reply(200, mockSingleShareCodeData);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({}),
      context.create(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(mockSingleShareCodeData);
  });

  describe("Error scenarios", () => {
    it("returns 502 if dvlaPostShareCode integration fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      mockAuthSuccess();

      api
        .post("/gateways/dvla/v1/share-code", {})
        .query({ linkingId: testLinkingId })
        .matchHeader("auth", testAuthToken)
        .reply(500, { message: "Internal Server Error" });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(502);
    });

    it("returns 502 if authentication fails during share code creation", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      api.get("/gateways/dvla/v1/authenticate").reply(403);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(502);
    });
  });
});
