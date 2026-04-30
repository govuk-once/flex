import { createUserId, it } from "@flex/testing";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v0/users/notifications", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const userId = createUserId("test-pairwise-id");
  const testPushId = "push-12345";

  const mockNotificationsData = [
    {
      NotificationID: "123456",
      Status: "READ",
      NotificationTitle: "test title",
      NotificationBody: "test body",
      DispatchedDateTime: "2026-01-01T00:00:00Z",
      MessageTitle: "message title",
      MessageBody: "message body",
    },
  ];

  const mockUdpPushIdSuccess = () =>
    api
      .get("/domains/udp/v1/users/push-id")
      .matchHeader("User-Id", userId)
      .reply(200, { pushId: testPushId });

  const mockUnsNotificationsSuccess = () =>
    api
      .get("/gateways/uns/v1/notifications")
      .query({ externalUserID: testPushId })
      .reply(200, mockNotificationsData);

  it("returns 200 and notifications data on success", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    mockUdpPushIdSuccess();
    mockUnsNotificationsSuccess();

    const result = await handler(
      privateGatewayEventWithAuthorizer.authenticated({}, userId),
      context.withSecret({ udpNotificationSecret: "test-value" }).create(), // pragma: allowlist secret
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(mockNotificationsData);
  });

  describe("Error scenarios", () => {
    it("returns 502 if UDP push ID lookup fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api.get("/domains/udp/v1/users/push-id").reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.authenticated({}, userId),
        context.withSecret({ udpNotificationSecret: "test-value" }).create(), // pragma: allowlist secret
      );

      expect(result.statusCode).toBe(502);
    });

    it("returns 502 if UNS notifications lookup fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockUdpPushIdSuccess();

      api
        .get("/gateways/uns/v1/notifications")
        .query({ externalUserID: testPushId })
        .reply(404);

      const result = await handler(
        privateGatewayEventWithAuthorizer.authenticated({}, userId),
        context.withSecret({ udpNotificationSecret: "test-value" }).create(), // pragma: allowlist secret
      );

      expect(result.statusCode).toBe(502);
    });
  });
});
