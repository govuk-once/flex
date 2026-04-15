import { it } from "@flex/testing";
import nock from "nock";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./get";

describe("GET /v1/driving-licence", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const testLinkingId = "test-user-linking-id";
  const testAuthToken = "test-id-token";
  const testProductKey = "prod-123";
  const testPairwiseId = "test-pairwise-id";

  beforeEach(() => {
    vi.stubEnv("flexDvlaTestUser", testLinkingId);
  });

  const mockUdpSuccess = () =>
    api
      .get("/domains/udp/v1/identity/dvla")
      .matchHeader("User-Id", testPairwiseId)
      .reply(200, {
        serviceId: testLinkingId,
        serviceName: "dvla",
      });

  const mockAuthSuccess = () =>
    api.get("/gateways/dvla/v1/authenticate").reply(200, {
      "id-token": testAuthToken,
      apiKeyExpiry: "2030-01-01T00:00:00Z", // pragma: allowlist secret
      passwordExpiry: "2030-01-01T00:00:00Z", // pragma: allowlist secret
    });

  const mockCustomerSuccess = (
    products?: {
      productType: string;
      productKey: string;
      productIdentifier: string;
      dateAdded: string;
    }[],
  ) =>
    api
      .get(`/gateways/dvla/v1/customer/${testLinkingId}`)
      .matchHeader("auth", testAuthToken)
      .reply(200, {
        linkingId: testLinkingId,
        customer: {
          customerId: "cust-999",
          recordStatus: "Substantive",
          customerType: "Individual",
          individualDetails: {
            lastName: "DOE",
            dateOfBirth: "1990-01-01",
          },
          products: products ?? [
            {
              productType: "Driving Licence",
              productKey: testProductKey,
              productIdentifier: "DL-12345",
              dateAdded: "2026-01-01T00:00:00Z",
            },
          ],
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
        dateOfBirth: "1990-01-01",
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
    it("returns 404 if the user has no DVLA linking ID in UDP", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api.get("/domains/udp/v1/identity/dvla").reply(404, {
        error: { message: "Not Found" },
      });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(404);
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

    it("returns 422 if the customer has no Driving Licence product", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      mockAuthSuccess();
      mockCustomerSuccess([]);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(422);
    });

    it("returns 502 if licence retrieval fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      mockAuthSuccess();
      mockCustomerSuccess();

      api.get(`/gateways/dvla/v1/licence/${testProductKey}`).reply(404);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({}),
        context.create(),
      );

      expect(result.statusCode).toBe(502);
    });
  });
});
