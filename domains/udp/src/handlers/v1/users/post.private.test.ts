import { createUserId, it } from "@flex/testing";
import { UserId } from "@flex/utils";
import type { PushId } from "@schemas/notifications";
import type { CreateUserRequest } from "@schemas/user";
import { createPushId } from "@tests/fixtures";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./post.private";

describe("POST /v1/users [private]", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const endpoint = "/users";

  const userId = createUserId();
  const pushId = createPushId();

  const body: CreateUserRequest = { userId, pushId };

  describe("request validation", () => {
    it.for<{ body: Partial<CreateUserRequest>; reason: string }>([
      { body: { userId }, reason: "is missing notification ID" },
      { body: { pushId }, reason: "is missing user ID" },
      {
        body: { pushId, userId: 123 as unknown as UserId },
        reason: "contains invalid user ID",
      },
      {
        body: { userId, pushId: 123 as unknown as PushId },
        reason: "contains invalid notification ID",
      },
      { body: {}, reason: "is empty" },
    ])(
      "returns 400 when payload $reason",
      async ({ body }, { context, privateGatewayEventWithAuthorizer }) => {
        const result = await handler(
          privateGatewayEventWithAuthorizer.post(endpoint, { body }),
          context.create(),
        );

        expect(result).toStrictEqual({
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Invalid request body" }),
        });
      },
    );
  });

  describe("response", () => {
    it("returns 204 when user is created", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api.post("/gateways/udp/v1/users", body).reply(204);

      const result = await handler(
        privateGatewayEventWithAuthorizer.post(endpoint, { body }),
        context.create(),
      );

      expect(result).toStrictEqual({ statusCode: 204, body: "" });
    });
  });

  describe("errors", () => {
    it("returns 502 when user creation fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api.post("/gateways/udp/v1/users", body).reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.post(endpoint, { body }),
        context.create(),
      );

      expect(result).toStrictEqual({ statusCode: 502, body: "" });
    });
  });
});
