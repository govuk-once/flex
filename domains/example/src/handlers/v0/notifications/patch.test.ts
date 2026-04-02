import { it } from "@flex/testing";
import { createUserId } from "@utils/parser";
import nock from "nock";
import { describe, expect, vi } from "vitest";

import { handler } from "./patch";

vi.mock("node:crypto", () => ({
  default: {
    createHmac: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue("test-push-id"),
    })),
  },
}));

describe("PATCH /v0/notifications", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const endpoint = "/notifications";
  const event = {
    body: { consentStatus: "accepted" },
  };

  const secrets = { udpNotificationSecret: "test-notification-secret" }; // pragma: allowlist secret
  const userId = createUserId("test-pairwise-id");

  const updatedNotifications = {
    consentStatus: "accepted",
    pushId: "test-push-id",
  };

  describe("request validation", () => {
    it.for([
      {
        body: { consentStatus: "yes" },
        reason: "contains invalid consent status",
      },
      { body: {}, reason: "is empty" },
    ])(
      "returns 400 when payload $reason",
      async ({ body }, { context, privateGatewayEventWithAuthorizer }) => {
        const result = await handler(
          privateGatewayEventWithAuthorizer.patch(endpoint, { body }),
          context.withSecret(secrets).create(), // pragma: allowlist secret
        );

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toStrictEqual({
          message: "Invalid request body",
        });
      },
    );
  });

  describe("response", () => {
    it("returns 200 when notifications are updated", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .post("/gateways/udp/v1/notifications")
        .matchHeader("requesting-service-user-id", userId)
        .reply(200, updatedNotifications);

      const result = await handler(
        privateGatewayEventWithAuthorizer.patch(endpoint, event),
        context.withSecret(secrets).create(), // pragma: allowlist secret
      );

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual(updatedNotifications);
    });
  });

  describe("errors", () => {
    it("returns 502 when upstream fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .post("/gateways/udp/v1/notifications")
        .matchHeader("requesting-service-user-id", userId)
        .reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.patch(endpoint, event),
        context.withSecret(secrets).create(), // pragma: allowlist secret
      );

      expect(result.statusCode).toBe(502);
    });
  });
});
