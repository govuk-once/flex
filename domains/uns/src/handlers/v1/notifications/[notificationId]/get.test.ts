import { createUserId, it } from "@flex/testing";
import nock from "nock";
import { describe, expect, vi } from "vitest";

import { handler } from "./get";

vi.mock("@utils/get-push-id");

describe("GET /v1/notifications/{notificationId}", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const userId = createUserId("test-pairwise-id");
  const testPushId = "push-12345";

  const mockNotificationsData = {
    NotificationID: "123456",
    Status: "READ",
    NotificationTitle: "test title",
    NotificationBody: "test body",
    DispatchedDateTime: "2026-01-01T00:00:00Z",
    MessageTitle: "message title",
    MessageBody: "message body",
  };

  const unknownId = "notification-unknown";

  const mockUdpPushIdSuccess = () =>
    api
      .get("/domains/udp/v1/users/push-id")
      .matchHeader("User-Id", userId)
      .reply(200, { pushId: testPushId });

  const mockUnsNotificationsSuccess = () =>
    api
      .get(
        `/gateways/uns/v1/notifications/${mockNotificationsData.NotificationID}`,
      )
      .query({ externalUserID: testPushId })
      .reply(200, mockNotificationsData);

  const mockUnsNotificationsFailure = () =>
    api
      .get(`/gateways/uns/v1/notifications/${unknownId}`)
      .query({ externalUserID: testPushId })
      .reply(404, {});

  it("returns 200 and notifications data on success", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    mockUdpPushIdSuccess();
    mockUnsNotificationsSuccess();

    const result = await handler(
      privateGatewayEventWithAuthorizer.authenticated(
        {
          pathParameters: {
            notificationId: mockNotificationsData.NotificationID,
          },
        },
        userId,
      ),
      context.withSecret({ udpNotificationSecret: "test-value" }).create(), // pragma: allowlist secret
    );

    expect(result.statusCode).toBe(200);
  });

  it("returns 200 with the matching notification", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    mockUdpPushIdSuccess();
    mockUnsNotificationsSuccess();

    const result = await handler(
      privateGatewayEventWithAuthorizer.authenticated(
        {
          pathParameters: {
            notificationId: mockNotificationsData.NotificationID,
          },
        },
        userId,
      ),
      context.withSecret({ udpNotificationSecret: "test-value" }).create(), // pragma: allowlist secret
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body) as {
      NotificationID: string;
    };
    expect(body.NotificationID).toBe(mockNotificationsData.NotificationID);
  });

  it("returns 200 with notifications mapped successfully", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    mockUdpPushIdSuccess();
    mockUnsNotificationsSuccess();

    const result = await handler(
      privateGatewayEventWithAuthorizer.authenticated(
        {
          pathParameters: {
            notificationId: mockNotificationsData.NotificationID,
          },
        },
        userId,
      ),
      context.withSecret({ udpNotificationSecret: "test-value" }).create(), // pragma: allowlist secret
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body) as Record<string, unknown>;
    expect(body).toMatchObject({
      NotificationID: "123456",
      Status: "READ",
      NotificationTitle: "test title",
      NotificationBody: "test body",
      DispatchedDateTime: "2026-01-01T00:00:00Z",
      MessageTitle: "message title",
      MessageBody: "message body",
    });
  });

  it("returns 404 when the notification ID does not exist", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    mockUdpPushIdSuccess();
    mockUnsNotificationsFailure();

    const result = await handler(
      privateGatewayEventWithAuthorizer.authenticated(
        {
          pathParameters: {
            notificationId: unknownId,
          },
        },
        userId,
      ),
      context.withSecret({ udpNotificationSecret: "test-value" }).create(), // pragma: allowlist secret
    );

    expect(result.statusCode).toBe(404);
  });
});
