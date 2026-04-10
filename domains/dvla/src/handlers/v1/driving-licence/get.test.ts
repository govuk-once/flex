import { it } from "@flex/testing";
import nock from "nock";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./get";

describe("GET /v1/driving-licence", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const testAuthToken = "test-id-token";
  const testProductKey = "prod-123";
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

  const mockCustomerSuccess = () =>
    api
      .get(`/gateways/dvla/v1/customer-summary/${testLinkingId}`)
      .matchHeader("auth", testAuthToken)
      .reply(200, {
        linkingId: testLinkingId,
        customerResponse: {
          customer: {
            customerId: testCustomerId,
            products: [
              {
                productType: "Driving Licence",
                productKey: testProductKey,
              },
            ],
          },
        },
      });

  it("returns 200 and licence data on success", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    mockUdpSuccess();
    mockAuthSuccess();
    mockCustomerSuccess();

    const mockLicenceData = {
      driver: {
        drivingLicenceNumber: "SMITH999999AB9YZ",
        firstNames: "JANE",
        lastName: "DOE",
      },
      licence: {
        type: "Full",
        status: "Valid",
      },
    };

    api
      .get(`/gateways/dvla/v1/licence/${testProductKey}`)
      .matchHeader("auth", testAuthToken)
      .reply(200, mockLicenceData);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({}),
      context.create(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(mockLicenceData);
  });

  describe("Error scenarios", () => {
    it("returns 422 if the customer record is incomplete (missing customer object)", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      mockAuthSuccess();

      api
        .get(`/gateways/dvla/v1/customer-summary/${testLinkingId}`)
        .reply(200, {
          linkingId: testLinkingId,
          hasErrors: false,
          customerResponse: {
            customer: {},
          },
        });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(422);
    });

    it("returns 422 if the products array is missing or empty", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      mockAuthSuccess();

      api
        .get(`/gateways/dvla/v1/customer-summary/${testLinkingId}`)
        .reply(200, {
          customerResponse: {
            customer: {
              customerId: testCustomerId,
              products: [],
            },
          },
        });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(422);
    });

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

    it("returns 502 if customer-summary call fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      mockAuthSuccess();
      api.get(`/gateways/dvla/v1/customer-summary/${testLinkingId}`).reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(502);
    });
  });
});
