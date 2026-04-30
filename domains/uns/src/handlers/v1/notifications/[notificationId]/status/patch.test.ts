import { createUserId, it } from "@flex/testing";
import nock from "nock";
import { describe, expect, vi } from "vitest";

import { handler } from "./patch";

vi.mock("@utils/get-push-id");

describe("PATCH /v1/notifications/{notificationId}/status", () => {
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

  const mockUnsPatchSuccess = () =>
    api
      .get(`/gateways/uns/v1/notifications/${mockNotificationId}/status`)
      .query({ externalUserID: testPushId })
      .reply(202);

  const mockUnsPatchNotFound = () =>
    api
      .get(`/gateways/uns/v1/notifications/${mockUnknownNotificationid}/status`)
      .query({ externalUserID: testPushId })
      .reply(404);

  it("returns 202 when status has been updated successfully", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    mockUdpPushIdSuccess();
    mockUnsPatchSuccess();

    const result = await handler(
      privateGatewayEventWithAuthorizer.authenticated({}, userId),
      context.withSecret({ udpNotificationSecret: "test-value" }).create(), // pragma: allowlist secret
    );

    expect(result.statusCode).toBe(202);
  });

  it("returns 404 when the notification ID does not exist", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    mockUdpPushIdSuccess();
    mockUnsPatchNotFound();

    const result = await handler(
      privateGatewayEventWithAuthorizer.authenticated({}, userId),
      context.withSecret({ udpNotificationSecret: "test-value" }).create(), // pragma: allowlist secret
    );
    expect(result.statusCode).toBe(404);
  });
});
