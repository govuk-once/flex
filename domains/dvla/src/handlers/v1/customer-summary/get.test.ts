import { it } from "@flex/testing";
import nock from "nock";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./get";

describe("GET /v1/customer-summary", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const testAuthToken = "test-id-token";
  const testLinkingId = "550e8400-e29b-41d4-a716-446655440000";
  const testCustomerId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

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

  it("returns 200 and full customer summary on success", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    mockUdpSuccess();
    mockAuthSuccess();

    const mockSummaryData = {
      linkingId: testLinkingId,
      hasErrors: false,
      customerResponse: {
        customer: {
          customerId: testCustomerId,
          customerNumber: "123456",
          products: [
            {
              productType: "Driving Licence",
              productKey: "prod-123",
            },
          ],
        },
      },
    };

    api
      .get(`/gateways/dvla/v1/customer-summary/${testLinkingId}`)
      .matchHeader("auth", testAuthToken)
      .reply(200, mockSummaryData);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({}),
      context.create(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(mockSummaryData);
  });

  describe("Error scenarios", () => {
    it("returns 502 if DVLA authentication fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      api.get("/gateways/dvla/v1/authenticate").reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(502);
    });

    it("returns 502 if customer-summary integration returns an error", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      mockAuthSuccess();

      api
        .get(`/gateways/dvla/v1/customer-summary/${testLinkingId}`)
        .reply(404, { message: "Not Found" });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(502);
    });

    it("returns 404 if the user linking ID cannot be found", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api.get("/domains/udp/v1/identity/dvla").reply(404);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(404);
    });
  });
});
