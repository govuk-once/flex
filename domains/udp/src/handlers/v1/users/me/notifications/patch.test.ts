import { it } from "@flex/testing";
import {
  createConsentStatus,
  createNotification,
  secrets,
  userId,
} from "@tests/fixtures";
import { getPushId } from "@utils/get-push-id";
import { describe, expect, vi } from "vitest";

import { handler } from "./patch";

vi.mock("@utils/get-push-id");

describe("PATCH /v1/users/me/notifications", () => {
  const endpoint = "/users/me/notifications";

  it("returns 200 with updated notifications", async ({ http, sdk }) => {
    const consentStatus = createConsentStatus("accepted");
    const notification = createNotification({ consentStatus });

    http
      .gateway("udp")
      .post("/notifications", {
        headers: {
          "requesting-service": "app",
          "requesting-service-user-id": userId,
        },
      })
      .reply(200, notification);

    const result = await handler(
      sdk.event.patch(endpoint, { userId, body: { consentStatus } }),
      sdk.context({ secrets }),
    );

    expect(vi.mocked(getPushId)).toHaveBeenCalledExactlyOnceWith(
      userId,
      secrets.udpNotificationSecret,
    );
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(notification);
  });

  it.for([
    { body: {}, reason: "is empty" },
    {
      body: { consentStatus: "yes" },
      reason: "contains invalid consent status",
    },
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

  it("returns 502 when the UDP create notifications integration fails", async ({
    http,
    sdk,
  }) => {
    const consentStatus = createConsentStatus("accepted");

    http
      .gateway("udp")
      .post("/notifications", {
        headers: {
          "requesting-service": "app",
          "requesting-service-user-id": userId,
        },
      })
      .reply(500);

    const result = await handler(
      sdk.event.patch(endpoint, { userId, body: { consentStatus } }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(502);
    expect(result.body).toBe("");
  });
});
