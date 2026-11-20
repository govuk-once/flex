import { it } from "@flex/testing";
import { pushId, secrets, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./patch";

describe("PATCH /v0/users/notifications", () => {
  const endpoint = "/users/notifications";

  const notifications = { consentStatus: "accepted", pushId };

  it.beforeEach(({ env }) => {
    env.set({ newUserProfileEnabled: "false" });
  });

  it("returns 200 with updated notifications and feature flags", async ({
    env,
    http,
    sdk,
  }) => {
    env.set({ newUserProfileEnabled: "true" });

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
        auth: userId,
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
      sdk.event.patch(endpoint, { auth: userId, body }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(400);
  });

  it.for([
    {
      reason: "reports out-of-sequence write timestamps",
      upstream: 409,
      expected: 409,
    },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the notifications update $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/users/push-id", { headers: { "User-Id": userId } })
        .reply(200, { pushId });
      http.gateway("udp").post("/notifications").reply(upstream);

      const result = await handler(
        sdk.event.patch(endpoint, {
          auth: userId,
          body: { consentStatus: "accepted" },
        }),
        sdk.context({ secrets }),
      );

      expect(result.statusCode).toBe(expected);
    },
  );
});
