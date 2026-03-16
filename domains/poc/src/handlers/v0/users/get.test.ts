import { it } from "@flex/testing";
import nock from "nock";
import { describe, expect, vi } from "vitest";

import { handler } from "./get";

const notificationsEndpoint = "/gateways/udp/v1/notifications";
const usersEndpoint = "/gateways/udp/v1/users";

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
    env,
    privateGatewayEventWithAuthorizer,
  }) => {
    env.set({ STAGE: "production" });

    gateway
      .get(notificationsEndpoint)
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
        newUserProfileEnabled: false,
      }),
    );
  });

  it("returns 200 and creates user and notifications when the user profile does not exist", async ({
    context,
    env,
    privateGatewayEventWithAuthorizer,
  }) => {
    env.set({ STAGE: "production" });

    gateway
      .get(notificationsEndpoint)
      .matchHeader("requesting-service-user-id", pairwiseId)
      .reply(404)
      .post(usersEndpoint)
      .reply(204)
      .post(notificationsEndpoint)
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
        newUserProfileEnabled: false,
      }),
    );
  });

  it("returns 500 when retrieving user notifications throws a non-404 error", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    gateway.get(notificationsEndpoint).reply(500);

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
      .get(notificationsEndpoint)
      .reply(404)
      .post(usersEndpoint)
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
      .get(notificationsEndpoint)
      .reply(404)
      .post(usersEndpoint)
      .reply(204)
      .post(notificationsEndpoint)
      .reply(500);

    const result = await handler(
      privateGatewayEventWithAuthorizer.get(endpoint),
      context
        .withSecret({ udpNotificationSecret: "test-notification-value" }) // pragma: allowlist secret
        .create(),
    );

    expect(result.statusCode).toBe(500);
  });

  describe("feature flags", () => {
    it.for([
      { stage: "development", expected: true },
      { stage: "staging", expected: true },
      { stage: "production", expected: false },
    ])(
      "returns newUserProfileEnabled=$expected when STAGE=$stage",
      async (
        { stage, expected },
        { context, env, privateGatewayEventWithAuthorizer },
      ) => {
        env.set({ STAGE: stage });

        gateway
          .get(notificationsEndpoint)
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
        expect(JSON.parse(result.body)).toMatchObject({
          newUserProfileEnabled: expected,
        });
      },
    );

    it("treats a personal stage as development (newUserProfileEnabled=true)", async ({
      context,
      env,
      privateGatewayEventWithAuthorizer,
    }) => {
      env.set({ STAGE: "ljones" });

      gateway
        .get(notificationsEndpoint)
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
      expect(JSON.parse(result.body)).toMatchObject({
        newUserProfileEnabled: true,
      });
    });

    it("respects a runtime process.env override over the environment-specific value", async ({
      context,
      env,
      privateGatewayEventWithAuthorizer,
    }) => {
      env.set({ STAGE: "staging", newUserProfileEnabled: "false" });

      gateway
        .get(notificationsEndpoint)
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
      expect(JSON.parse(result.body)).toMatchObject({
        newUserProfileEnabled: false,
      });
    });
  });
});
