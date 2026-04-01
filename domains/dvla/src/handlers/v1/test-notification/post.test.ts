import { it } from "@flex/testing";
import nock from "nock";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./post";

describe("POST /v1/test-notification", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const testLinkingId = "test-user-linking-id";
  const testAuthToken = "test-id-token";
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

  it("returns 202 when notification is successfully sent", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    mockUdpSuccess();
    mockAuthSuccess();

    api.post(`/gateways/dvla/v1/test-notification/${testLinkingId}`).reply(202);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({}),
      context.create(),
    );

    expect(result.statusCode).toBe(202);
  });

  describe("Error scenarios", () => {
    it("returns 502 if the notification gateway returns an error", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpSuccess();
      mockAuthSuccess();

      api
        .post(`/gateways/dvla/v1/test-notification/${testLinkingId}`)
        .matchHeader("auth", testAuthToken)
        .reply(500, { message: "Internal Server Error" });

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
