import { it } from "@flex/testing";
import nock from "nock";
import { describe, expect, vi } from "vitest";

import { handler } from "./delete";

vi.mock("node:crypto", () => ({
  default: {
    createHmac: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue("test-external-user-id"),
    })),
  },
}));

describe("DELETE /v1/notifications/{notificationId}", () => {
  const gateway = nock("https://execute-api.eu-west-2.amazonaws.com");
  const notificationId = "notification-1";

  it("returns 204 when delete notification is successful", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    gateway
      .delete(`/notifications/${notificationId}`)
      .query({ externalUserID: "test-external-user-id" })
      .reply(204);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "DELETE",
        pathParameters: { notificationId },
      }),
      context
        .withSecret({
          unsNotificationSecret: "dummy", // pragma: allowlist secret
        })
        .create(),
    );

    expect(result.statusCode).toBe(204);
  });

  it("returns 404 when notification is not found", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    gateway
      .delete(`/notifications/${notificationId}`)
      .query({ externalUserID: "test-external-user-id" })
      .reply(404);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "DELETE",
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
      .delete(`/notifications/${notificationId}`)
      .query({ externalUserID: "test-external-user-id" })
      .reply(500);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "DELETE",
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
