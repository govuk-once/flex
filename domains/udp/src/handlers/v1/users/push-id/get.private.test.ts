import { createUserId, it } from "@flex/testing";
import { createPushId } from "@tests/fixtures";
import { getPushId } from "@utils/get-push-id";
import { describe, expect, vi } from "vitest";

import { handler } from "./get.private";

vi.mock("@utils/get-push-id");

describe("GET /v1/users/push-id", () => {
  const endpoint = "/v1/users/push-id";
  const secrets = { udpNotificationSecret: "test-notification-secret" }; // pragma: allowlist secret

  const userId = createUserId("test-pairwise-id");
  const pushId = createPushId("mocked-push-id");

  describe("response", () => {
    it("returns 200 and the uns user pushId", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      vi.mocked(getPushId).mockReturnValue(pushId);

      const result = await handler(
        privateGatewayEventWithAuthorizer.get(endpoint, {
          headers: { "User-Id": userId },
        }),
        context.withSecret(secrets).create(),
      );

      expect(vi.mocked(getPushId)).toHaveBeenCalledWith(
        userId,
        secrets.udpNotificationSecret,
      );

      expect(result.statusCode).toBe(200);
      expect(result.headers).toStrictEqual({
        "Content-Type": "application/json",
      });

      expect(JSON.parse(result.body)).toStrictEqual({
        pushId,
      });
    });
  });

  describe("errors", () => {
    it("returns 500 when pushId generation throws an error", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      vi.mocked(getPushId).mockImplementation(() => {
        throw new Error("User ID and secret key cannot be empty");
      });

      const result = await handler(
        privateGatewayEventWithAuthorizer.get(endpoint, {
          headers: { "User-Id": userId },
        }),
        context.withSecret(secrets).create(),
      );

      expect(result.statusCode).toBe(500);
    });
  });
});
