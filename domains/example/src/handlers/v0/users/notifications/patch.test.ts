import { createUserId, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./patch";

describe("PATCH /v0/users/notifications", () => {
  const endpoint = "/users/notifications";

  const userId = createUserId("test-pairwise-id");
  // TODO: Create a branded cast for push IDs?
  const pushId = "test-push-id";
  const secrets = { udpNotificationSecret: "test-notification-secret" }; // pragma: allowlist secret

  const notifications = { consentStatus: "accepted", pushId };

  it("returns 200 with updated notifications and feature flags", async ({
    http,
    sdk,
  }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId });
    http
      .gateway("udp")
      .post("/notifications", {
        headers: { "requesting-service-user-id": userId },
        body: { consentStatus: "accepted", pushId },
      })
      .reply(200, notifications);

    const result = await handler(
      sdk.event.patch(endpoint, {
        userId,
        body: { consentStatus: "accepted" },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({
      ...notifications,
      featureFlags: { newUserProfileEnabled: true },
    });
  });

  it.for([
    { body: { consentStatus: "invalid" }, reason: "an invalid consent status" },
    { body: {}, reason: "empty" },
  ])("returns 400 when body is $reason", async ({ body }, { sdk }) => {
    const result = await handler(
      sdk.event.patch(endpoint, { userId, body }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(400);
  });

  it("returns 502 when the notifications update fails", async ({
    http,
    sdk,
  }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId });
    http.gateway("udp").post("/notifications").reply(500);

    const result = await handler(
      sdk.event.patch(endpoint, {
        userId,
        body: { consentStatus: "accepted" },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(502);
  });
});
