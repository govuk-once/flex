import { it } from "@flex/testing";
import { pushId, secrets, userId } from "@tests/fixtures";
import { describe, expect, vi } from "vitest";

import { handler } from "./patch";

vi.mock("node:crypto", () => ({
  default: {
    createHmac: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue("test-push-id"),
    })),
  },
}));

describe("PATCH /v0/notifications", () => {
  const endpoint = "/notifications";

  const notifications = { consentStatus: "accepted", pushId };

  it.for([
    {
      body: { consentStatus: "yes" },
      reason: "contains invalid consent status",
    },
    { body: {}, reason: "is empty" },
  ])("returns 400 when payload $reason", async ({ body }, { sdk }) => {
    const result = await handler(
      sdk.event.patch(endpoint, { userId, body }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toStrictEqual({
      message: "Invalid request body",
    });
  });

  it("returns 200 when notifications are updated", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .post("/notifications", {
        headers: { "requesting-service-user-id": userId },
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
    expect(JSON.parse(result.body)).toStrictEqual(notifications);
  });

  it("returns 502 when the upstream fails", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .post("/notifications", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(500);

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
