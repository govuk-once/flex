import { createUserId, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v0/users/notifications", () => {
  const endpoint = "/users/notifications";

  const userId = createUserId("test-pairwise-id");
  // TODO: Create a branded cast for push IDs?
  const pushId = "test-push-id";
  const secrets = { udpNotificationSecret: "test-notification-secret" }; // pragma: allowlist secret

  const notifications = [
    {
      NotificationID: "123456",
      Status: "READ",
      NotificationTitle: "test title",
      NotificationBody: "test body",
      DispatchedDateTime: "2026-01-01T00:00:00Z",
      MessageTitle: "message title",
      MessageBody: "message body",
    },
  ];

  it("returns 200 with notifications", async ({ http, sdk }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId });
    http
      .gateway("uns")
      .get("/notifications", { query: { externalUserID: pushId } })
      .reply(200, notifications);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(notifications);
  });

  it("returns 502 when the push ID lookup fails", async ({ http, sdk }) => {
    http.domain("udp").get("/users/push-id").reply(500);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(502);
  });

  it("returns 502 when the notifications lookup fails", async ({
    http,
    sdk,
  }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId });

    http
      .gateway("uns")
      .get("/notifications", { query: { externalUserID: pushId } })
      .reply(404);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(502);
  });
});
