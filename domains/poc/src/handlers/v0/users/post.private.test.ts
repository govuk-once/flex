import { it } from "@flex/testing";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./post.private";

describe("POST /v0/users [private]", () => {
  const gateway = nock("https://execute-api.eu-west-2.amazonaws.com");
  const endpoint = "/users";

  it("returns 204 when user is created successfully", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    gateway
      .post("/gateways/udp/v1/user", {
        notificationId: "test-notification-id",
        userId: "test-user-id",
      })
      .reply(204);

    const result = await handler(
      privateGatewayEventWithAuthorizer.post(endpoint, {
        body: {
          notificationId: "test-notification-id",
          userId: "test-user-id",
        },
      }),
      context
        .withSecret({ udpNotificationSecret: "test-notification-value" }) // pragma: allowlist secret
        .create(),
    );

    expect(result.statusCode).toBe(204);
  });

  it.for([
    {
      body: { notificationId: "test-notification-id" },
      reason: "missing user ID",
    },
    { body: { userId: "test-user-id" }, reason: "missing notification ID" },
    { body: {}, reason: "empty" },
  ])(
    "returns 400 when body is $reason",
    async ({ body }, { context, privateGatewayEventWithAuthorizer }) => {
      const result = await handler(
        privateGatewayEventWithAuthorizer.post(endpoint, { body }),
        context
          .withSecret({ udpNotificationSecret: "test-notification-value" }) // pragma: allowlist secret
          .create(),
      );

      expect(result.statusCode).toBe(400);
    },
  );

  it("returns 500 when user creation fails", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    gateway.post("/gateways/udp/v1/user").reply(500);

    const result = await handler(
      privateGatewayEventWithAuthorizer.post(endpoint, {
        body: {
          notificationId: "test-notification-id",
          userId: "test-user-id",
        },
      }),
      context
        .withSecret({ udpNotificationSecret: "test-notification-value" }) // pragma: allowlist secret
        .create(),
    );

    expect(result.statusCode).toBe(500);
  });
});
