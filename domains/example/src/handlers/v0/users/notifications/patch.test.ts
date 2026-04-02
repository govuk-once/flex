import { createUserId, it } from "@flex/testing";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./patch";

describe("PATCH /v0/users/notifications", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const endpoint = "/users/notifications";

  const userId = createUserId("test-pairwise-id");

  const mockUdpGetPushIdSuccess = () =>
    api
      .get("/domains/udp/v1/users/push-id")
      .matchHeader("User-Id", userId)
      .reply(200, {
        pushId: "derived-notification-id",
      });

  it("updates user notifications successfully and returns 204 with updated notifications", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    mockUdpGetPushIdSuccess();
    api
      .post("/gateways/udp/v1/notifications")
      .matchHeader("requesting-service-user-id", userId)
      .reply(200, {
        consentStatus: "accepted",
        pushId: "derived-notification-id",
      });

    const result = await handler(
      privateGatewayEventWithAuthorizer.patch(endpoint, {
        body: { consentStatus: "accepted" },
      }),
      context
        .withSecret({ udpNotificationSecret: "test-notification-value" }) // pragma: allowlist secret
        .create(),
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe(
      JSON.stringify({
        consentStatus: "accepted",
        pushId: "derived-notification-id",
        featureFlags: {
          newUserProfileEnabled: true,
        },
      }),
    );
  });

  it.for([
    {
      body: { consentStatus: "invalid" },
      reason: "passes an invalid consent status",
    },
    { body: {}, reason: "is empty" },
  ])(
    "returns 400 when body $reason",
    async ({ body }, { context, privateGatewayEventWithAuthorizer }) => {
      const result = await handler(
        privateGatewayEventWithAuthorizer.patch(endpoint, { body }),
        context
          .withSecret({ udpNotificationSecret: "test-notification-value" }) // pragma: allowlist secret
          .create(),
      );

      expect(result.statusCode).toBe(400);
    },
  );

  it("returns 502 when updating user notifications fails", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    mockUdpGetPushIdSuccess();
    api.post("/gateways/udp/v1/notifications").reply(500);

    const result = await handler(
      privateGatewayEventWithAuthorizer.patch(endpoint, {
        body: { consentStatus: "accepted" },
      }),
      context
        .withSecret({ udpNotificationSecret: "test-notification-value" }) // pragma: allowlist secret
        .create(),
    );

    expect(result.statusCode).toBe(502);
  });
});
