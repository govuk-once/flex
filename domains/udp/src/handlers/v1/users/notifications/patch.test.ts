import { createUserId, it } from "@flex/testing";
import type {
  UpdateNotificationPreferencesOutboundResponse,
  UpdateNotificationPreferencesRequest,
} from "@schemas/notifications";
import { createNotificationId } from "@tests/fixtures";
import { getNotificationId } from "@utils/get-notification-id";
import nock from "nock";
import { describe, expect, vi } from "vitest";

import { handler } from "./patch";

vi.mock("@utils/get-notification-id");

describe("PATCH /v1/users/notifications", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const endpoint = "/users/notifications";

  const userId = createUserId("test-pairwise-id");
  const secrets = { udpNotificationSecret: "test-notification-secret" }; // pragma: allowlist secret

  const body: UpdateNotificationPreferencesRequest = {
    consentStatus: "accepted",
  };
  const updatedNotifications: UpdateNotificationPreferencesOutboundResponse = {
    consentStatus: "accepted",
    notificationId: createNotificationId("updated-id"),
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

        expect(result).toStrictEqual({
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Invalid request body" }),
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
        privateGatewayEventWithAuthorizer.patch(endpoint, { body }),
        context
          .withSecret(secrets) // pragma: allowlist secret
          .create(),
      );

      expect(vi.mocked(getNotificationId)).toHaveBeenCalledExactlyOnceWith(
        userId,
        secrets.udpNotificationSecret,
      );

      expect(result.statusCode).toBe(200);
      expect(result.headers).toStrictEqual({
        "Content-Type": "application/json",
      });
      expect(JSON.parse(result.body)).toStrictEqual(updatedNotifications);
    });
  });

  describe("errors", () => {
    it("returns 502 when notifications update fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .post("/gateways/udp/v1/notifications")
        .matchHeader("requesting-service-user-id", userId)
        .reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.patch(endpoint, { body }),
        context.withSecret(secrets).create(), // pragma: allowlist secret
      );

      expect(result).toStrictEqual({ statusCode: 502, body: "" });
    });
  });
});
