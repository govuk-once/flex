import { it } from "@flex/testing";
import status from "http-status";
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
      .reply(status.OK, mockSummaryData);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({}),
      context.create(),
    );

    expect(result.statusCode).toBe(status.OK);
    const { linkingId: _, ...expectedBody } = mockSummaryData;
    expect(JSON.parse(result.body)).toStrictEqual(expectedBody);
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

    it("returns 502 if customer-summary integration returns an error", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      mockAuthSuccess();

      api
        .get(`/gateways/dvla/v1/customer-summary/${testLinkingId}`)
        .reply(status.INTERNAL_SERVER_ERROR, { message: "Not Found" });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(status.BAD_GATEWAY);
    });

    it("returns 404 if the user linking ID cannot be found", async ({
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
