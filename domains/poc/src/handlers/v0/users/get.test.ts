import { it } from "@flex/testing";
import nock from "nock";
import { describe, expect, vi } from "vitest";

import { handler } from "./get";

vi.mock("node:crypto", () => ({
  default: {
    createHmac: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue("test-notification-id"),
    })),
  },
}));

describe("GET /v0/users", () => {
  const gateway = nock("https://execute-api.eu-west-2.amazonaws.com");
  const endpoint = "/users";

  const pairwiseId = "test-pairwise-id";

  it("returns 200 with aggregated profile when the user profile exists", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    gateway
      .get("/gateways/udp/v1/notifications")
      .matchHeader("requesting-service-user-id", pairwiseId)
      .reply(200, {
        consentStatus: "accepted",
        notificationId: "existing-notification-id",
      });

    const result = await handler(
      privateGatewayEventWithAuthorizer.get(endpoint),
      context
        .withSecret({ udpNotificationSecret: "test-notification-value" }) // pragma: allowlist secret
        .create(),
    );

    expect(result.statusCode).toBe(200);
    expect(result.headers).toStrictEqual({
      "Content-Type": "application/json",
    });
    expect(result.body).toBe(
      JSON.stringify({
        userId: "test-pairwise-id",
        notificationId: "test-notification-id",
        preferences: {
          notifications: {
            consentStatus: "accepted",
            notificationId: "existing-notification-id",
          },
        },
      }),
    );
  });

  it("returns 200 and creates user and notifications when the user profile does not exist", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    gateway
      .get("/gateways/udp/v1/notifications")
      .matchHeader("requesting-service-user-id", pairwiseId)
      .reply(404)
      .post("/gateways/udp/v1/users")
      .reply(204)
      .post("/gateways/udp/v1/notifications")
      .matchHeader("requesting-service-user-id", pairwiseId)
      .reply(200, {
        consentStatus: "unknown",
        notificationId: "new-notification-id",
      });

    const result = await handler(
      privateGatewayEventWithAuthorizer.get(endpoint),
      context
        .withSecret({ udpNotificationSecret: "test-notification-value" }) // pragma: allowlist secret
        .create(),
    );

    expect(result.statusCode).toBe(200);
    expect(result.headers).toStrictEqual({
      "Content-Type": "application/json",
    });
    expect(result.body).toBe(
      JSON.stringify({
        userId: "test-pairwise-id",
        notificationId: "test-notification-id",
        preferences: {
          notifications: {
            consentStatus: "unknown",
            notificationId: "new-notification-id",
          },
        },
      }),
    );
  });

  it("returns 500 when retrieving user notifications throws a non-404 error", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    gateway.get("/gateways/udp/v1/notifications").reply(500);

    const result = await handler(
      privateGatewayEventWithAuthorizer.get(endpoint),
      context
        .withSecret({ udpNotificationSecret: "test-notification-value" }) // pragma: allowlist secret
        .create(),
    );

    expect(result.statusCode).toBe(500);
  });

  it("returns 500 when user creation fails", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    gateway
      .get("/gateways/udp/v1/notifications")
      .reply(404)
      .post("/gateways/udp/v1/users")
      .reply(500);

    const result = await handler(
      privateGatewayEventWithAuthorizer.get(endpoint),
      context
        .withSecret({ udpNotificationSecret: "test-notification-value" }) // pragma: allowlist secret
        .create(),
    );

    expect(result.statusCode).toBe(500);
  });

  it("returns 500 when user notification creation fails", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    gateway
      .get("/gateways/udp/v1/notifications")
      .reply(404)
      .post("/gateways/udp/v1/users")
      .reply(204)
      .post("/gateways/udp/v1/notifications")
      .reply(500);

    const result = await handler(
      privateGatewayEventWithAuthorizer.get(endpoint),
      context
        .withSecret({ udpNotificationSecret: "test-notification-value" }) // pragma: allowlist secret
        .create(),
    );

    expect(result.statusCode).toBe(500);
  });
});
