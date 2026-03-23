import { createUserId, it } from "@flex/testing";
import nock from "nock";
import { describe, expect, vi } from "vitest";

import { handler } from "./patch";

vi.mock("node:crypto", () => ({
  default: {
    createHmac: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue("test-notification-id"),
    })),
  },
}));

describe("PATCH /v0/users/notifications", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const endpoint = "/users/notifications";

  const userId = createUserId("test-pairwise-id");

  it("updates user notifications successfully and returns 204 with updated notifications", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    api
      .post("/gateways/udp/v1/notifications")
      .matchHeader("requesting-service-user-id", userId)
      .reply(200, {
        consentStatus: "accepted",
        notificationId: "derived-notification-id",
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
        notificationId: "derived-notification-id",
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
