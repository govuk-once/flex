import { it } from "@flex/testing";
import nock from "nock";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./delete";

describe("DELETE /v1/share-code/:id", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const testAuthToken = "test-id-token";
  const testLinkingId = "550e8400-e29b-41d4-a716-446655440000";
  const testTokenId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  beforeEach(() => {
    nock.cleanAll();
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

  const mockCancelledShareCodeData = {
    linkingId: testLinkingId,
    shareCode: {
      state: "cancelled",
      tokenId: testTokenId,
      token: "B2CDFGHJ",
      drivingLicenceNumber: "SMITH952052S99AB",
      driverId: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
      documentReference: "REF12345",
      created: "2026-05-01T10:00:00Z",
      expiry: "2026-05-22T10:00:00Z",
      status: "inactive",
      cancelled: "2026-05-07T14:00:00Z",
    },
  };

  it("returns 200 and the cancelled share code on success", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    mockUdpSuccess();
    mockAuthSuccess();

    api
      .delete(`/gateways/dvla/v1/share-code/${testTokenId}`)
      .query({ linkingId: testLinkingId })
      .matchHeader("auth", testAuthToken)
      .reply(200, mockCancelledShareCodeData);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        pathParameters: { id: testTokenId },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(mockCancelledShareCodeData);
  });

  describe("Error scenarios", () => {
    it("returns 502 if dvlaDeleteShareCode integration fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      mockAuthSuccess();

      api
        .delete(`/gateways/dvla/v1/share-code/${testTokenId}`)
        .query({ linkingId: testLinkingId })
        .reply(500, { message: "DVLA Delete Failed" });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          pathParameters: { id: testTokenId },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(502);
    });

    it("returns 404 if the token to delete is not found by DVLA", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      mockAuthSuccess();

      api
        .delete(`/gateways/dvla/v1/share-code/${testTokenId}`)
        .query({ linkingId: testLinkingId })
        .reply(404, { message: "Token not found" });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          pathParameters: { id: testTokenId },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(404);
    });
  });
});
