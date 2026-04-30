import { it } from "@flex/testing";
import nock from "nock";
import { describe, expect } from "vitest";

import { MOCK_NOTIFICATIONS } from "../../../../data/notifications";
import { handler } from "./get";

describe("GET /v1/notifications/{notificationId}", () => {
  const gateway = nock("https://execute-api.eu-west-2.amazonaws.com");
  const endpoint = "/notifications/:notificationId";
  const pushId = "test-push-id";

  const notification = {
    NotificationID: "notification-1",
    NotificationTitle: "Your application has been received",
    NotificationBody:
      "We have received your application and will be in touch shortly.",
    MessageTitle: "Your application has been received",
    MessageBody:
      "We have received your application and will be in touch shortly.",
    DispatchedDateTime: "2026-01-01T00:00:00.000Z",
    Status: "RECEIVED",
  };

  const unknownNotification = {
    NotificationID: "notification-unknown",
    NotificationTitle: "Your application has been received",
    NotificationBody:
      "We have received your application and will be in touch shortly.",
    MessageTitle: "Your application has been received",
    MessageBody:
      "We have received your application and will be in touch shortly.",
    DispatchedDateTime: "2026-01-01T00:00:00.000Z",
    Status: "RECEIVED",
  };

  const unknownId = "notification-unknown";

  it("returns 200 with the matching notification", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        pathParameters: { notificationId: notification.NotificationID },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body) as {
      NotificationID: string;
    };
    expect(body.NotificationID).toBe(unknownNotification.NotificationID);
  });

  it("returns 200 with notifications mapped successfully", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    gateway.get("/gateways/udp/v1/users/push-id").reply(200, { pushId });
    gateway
      .get("/notifications/notificationID")
      .query({ externalUserID: pushId })
      .reply(200, [notification]);

    const result = await handler(
      privateGatewayEventWithAuthorizer.get(endpoint),
      context.create(),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body) as Record<string, unknown>[];
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      NotificationID: "notification-1",
      NotificationTitle: "Your application has been received",
      NotificationBody:
        "We have received your application and will be in touch shortly.",
      MessageTitle: "Your application has been received",
      MessageBody:
        "We have received your application and will be in touch shortly.",
      DispatchedDateTime: "2026-01-01T00:00:00.000Z",
      Status: "RECEIVED",
    });
  });

  it("returns 404 when the notification ID does not exist", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        pathParameters: { notificationId: unknownId },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(404);
  });
});
