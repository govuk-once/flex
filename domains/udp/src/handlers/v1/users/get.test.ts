import { createUserId, it } from "@flex/testing";
import type {
  CreateNotificationPreferencesResponse,
  UpdateNotificationPreferencesOutboundResponse,
} from "@schemas/notifications";
import type { CreateUserRequest } from "@schemas/user";
import { createPushId } from "@tests/fixtures";
import { getPushId } from "@utils/get-push-it";
import nock from "nock";
import { describe, expect, vi } from "vitest";

import { handler } from "./get";

vi.mock("@utils/get-push-it");

describe("GET /v1/users", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const endpoint = "/users";

  const secrets = { udpNotificationSecret: "test-notification-secret" }; // pragma: allowlist secret

  const userId = createUserId("test-pairwise-id");
  const pushId = createPushId();

  const user: CreateUserRequest = { userId, pushId };

  const foundNotificationPreferences: UpdateNotificationPreferencesOutboundResponse =
    {
      consentStatus: "accepted",
      pushId: createPushId("existing-id"),
    };

  const createdNotificationPreferences: CreateNotificationPreferencesResponse =
    {
      consentStatus: "unknown",
      pushId: createPushId("created-id"),
    };

  describe("response", () => {
    it("returns 200 when user profile exists", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/udp/v1/notifications")
        .matchHeader("requesting-service-user-id", userId)
        .reply(200, foundNotificationPreferences);

      const result = await handler(
        privateGatewayEventWithAuthorizer.get(endpoint),
        context
          .withSecret(secrets) // pragma: allowlist secret
          .create(),
      );

      expect(vi.mocked(getPushId)).toHaveBeenCalledExactlyOnceWith(
        userId,
        secrets.udpNotificationSecret,
      );

      expect(result.statusCode).toBe(200);
      expect(result.headers).toStrictEqual({
        "Content-Type": "application/json",
      });
      expect(JSON.parse(result.body)).toStrictEqual({
        userId,
        notifications: foundNotificationPreferences,
      });
    });

    it("returns 200 and creates user when user profile does not exist", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/udp/v1/notifications")
        .matchHeader("requesting-service-user-id", userId)
        .reply(404);

      api.post("/domains/udp/v1/users", user).reply(204);

      api
        .post("/gateways/udp/v1/notifications")
        .matchHeader("requesting-service-user-id", userId)
        .reply(200, createdNotificationPreferences);

      const result = await handler(
        privateGatewayEventWithAuthorizer.get(endpoint),
        context.withSecret(secrets).create(), // pragma: allowlist secret
      );

      expect(result.statusCode).toBe(200);
      expect(result.headers).toStrictEqual({
        "Content-Type": "application/json",
      });
      expect(JSON.parse(result.body)).toStrictEqual({
        userId,
        notifications: createdNotificationPreferences,
      });
    });
  });

  describe("errors", () => {
    it("returns 502 when notifications lookup fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/udp/v1/notifications")
        .matchHeader("requesting-service-user-id", userId)
        .reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.get(endpoint),
        context.withSecret(secrets).create(), // pragma: allowlist secret
      );

      expect(result).toStrictEqual({ statusCode: 502, body: "" });
    });

    it("returns 502 when user creation fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/udp/v1/notifications")
        .matchHeader("requesting-service-user-id", userId)
        .reply(404);

      api.post("/domains/udp/v1/users", user).reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.get(endpoint),
        context.withSecret(secrets).create(), // pragma: allowlist secret
      );

      expect(result).toStrictEqual({ statusCode: 502, body: "" });
    });

    it("returns 502 when notifications creation fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/udp/v1/notifications")
        .matchHeader("requesting-service-user-id", userId)
        .reply(404);

      api.post("/domains/udp/v1/users", user).reply(204);

      api
        .post("/gateways/udp/v1/notifications")
        .matchHeader("requesting-service-user-id", userId)
        .reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.get(endpoint),
        context.withSecret(secrets).create(), // pragma: allowlist secret
      );

      expect(result).toStrictEqual({ statusCode: 502, body: "" });
    });
  });
});
