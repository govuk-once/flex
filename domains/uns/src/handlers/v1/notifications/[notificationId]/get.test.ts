import { it } from "@flex/testing";
import nock from "nock";
import { describe, expect, vi } from "vitest";

import { handler } from "./get";

vi.mock("node:crypto", () => ({
  default: {
    createHmac: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue("test-external-user-id"),
    })),
  },
}));

describe("GET /v1/notifications/{notificationId}", () => {
  const gateway = nock("https://execute-api.eu-west-2.amazonaws.com");
  const notificationId = "notification-1";

  const gdsNotification = {
    NotificationID: notificationId,
    NotificationTitle: "Your application has been received",
    NotificationBody:
      "We have received your application and will be in touch shortly.",
    MessageTitle: "Your application has been received",
    MessageBody:
      "We have received your application and will be in touch shortly.",
    DispatchedDateTime: "2026-03-10T09:00:00.000Z",
    Status: "RECEIVED",
  };

  it("returns 200 with the matching notification", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    gateway
      .get(`/notifications/${notificationId}`)
      .query({ externalUserID: "test-external-user-id" })
      .reply(200, gdsNotification);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        pathParameters: { notificationId },
      }),
      context
        .withSecret({
          unsNotificationSecret: "dummy", // pragma: allowlist secret
        })
        .create(),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body) as unknown as Record<string, unknown>;
    expect(body.NotificationID).toBe(notificationId);
  });

  it("returns 404 when notification is not found", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    gateway
      .get(`/notifications/${notificationId}`)
      .query({ externalUserID: "test-external-user-id" })
      .reply(404);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        pathParameters: { notificationId },
      }),
      context
        .withSecret({
          unsNotificationSecret: "dummy", // pragma: allowlist secret
        })
        .create(),
    );

    expect(result.statusCode).toBe(404);
  });

  it("returns 500 when fatal error occours", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    gateway
      .get(`/notifications/${notificationId}`)
      .query({ externalUserID: "test-external-user-id" })
      .reply(500);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        pathParameters: { notificationId },
      }),
      context
        .withSecret({
          unsNotificationSecret: "dummy", // pragma: allowlist secret
        })
        .create(),
    );

    expect(result.statusCode).toBe(500);
  });
});
