import { it } from "@flex/testing";
import nock from "nock";
import { describe, expect, vi } from "vitest";

import { handler } from "./patch";

vi.mock("node:crypto", () => ({
  default: {
    createHmac: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue("test-external-user-id"),
    })),
  },
}));

describe("PATCH /v1/notifications/{notificationId}/status", () => {
  const gateway = nock("https://execute-api.eu-west-2.amazonaws.com");
  const notificationId = "notification-1";

  it("returns 202 when update is successful", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    gateway
      .patch(`/notifications/${notificationId}`)
      .query({ externalUserID: "test-external-user-id" })
      .reply(202);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "PATCH",
        pathParameters: { notificationId },
        body: JSON.stringify({ Status: "READ" }),
      }),
      context
        .withSecret({
          unsNotificationSecret: "dummy", // pragma: allowlist secret
        })
        .create(),
    );

    expect(result.statusCode).toBe(202);
  });

  it("returns 404 when notification is not found", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    gateway
      .patch(`/notifications/${notificationId}`)
      .query({ externalUserID: "test-external-user-id" })
      .reply(404);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "PATCH",
        pathParameters: { notificationId },
        body: JSON.stringify({ Status: "READ" }),
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
      .patch(`/notifications/${notificationId}`)
      .query({ externalUserID: "test-external-user-id" })
      .reply(500);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "PATCH",
        pathParameters: { notificationId },
        body: JSON.stringify({ Status: "READ" }),
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
