import { createUserId, it } from "@flex/testing";
import nock from "nock";
import { describe, expect, vi } from "vitest";

import { handler } from "./delete";

vi.mock("@utils/get-push-id");

describe("DELETE /v1/notifications/{notificationId}", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const userId = createUserId("test-pairwise-id");
  const testPushId = "push-12345";

  const mockNotificationId = "not-1";
  const mockUnknownNotificationid = "NotAnId";

  const mockUdpPushIdSuccess = () =>
    api
      .get("/domains/udp/v1/users/push-id")
      .matchHeader("User-Id", userId)
      .reply(200, { pushId: testPushId });

  const mockUnsDeleteSuccess = () =>
    api
      .delete(`/gateways/uns/v1/notifications/${mockNotificationId}`)
      .query({ externalUserID: testPushId })
      .reply(200);

  const mockUnsDeleteNotFound = () =>
    api
      .delete(`/gateways/uns/v1/notifications/${mockUnknownNotificationid}`)
      .query({ externalUserID: testPushId })
      .reply(404);

  it("returns 202 when status has been updated successfully", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    mockUdpPushIdSuccess();
    mockUnsDeleteSuccess();

    const result = await handler(
      privateGatewayEventWithAuthorizer.authenticated(
        {
          body: JSON.stringify({ Status: "READ" }),
          pathParameters: { notificationId: mockNotificationId },
        },
        userId,
      ),
      context.withSecret({ udpNotificationSecret: "test-value" }).create(), // pragma: allowlist secret
    );

    expect(result.statusCode).toBe(204);
  });

  it("returns 404 when the notification ID does not exist", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    mockUdpPushIdSuccess();
    mockUnsDeleteNotFound();

    const result = await handler(
      privateGatewayEventWithAuthorizer.authenticated(
        {
          body: JSON.stringify({ Status: "READ" }),
          pathParameters: { notificationId: mockUnknownNotificationid },
        },
        userId,
      ),
      context.withSecret({ udpNotificationSecret: "test-value" }).create(), // pragma: allowlist secret
    );
    expect(result.statusCode).toBe(404);
  });
});
