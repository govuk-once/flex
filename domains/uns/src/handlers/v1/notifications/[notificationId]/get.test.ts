import { it } from "@flex/testing";
import {
  notification,
  notificationId,
  pushId,
  secrets,
  userId,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/notifications/:notificationId", () => {
  const endpoint = `/notifications/${notificationId}`;

  it("returns 200 with the notification", async ({ http, sdk }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId });
    http
      .gateway("uns")
      .get(`/notifications/${notificationId}`, {
        query: { externalUserID: pushId },
      })
      .reply(200, notification);

    const result = await handler(
      sdk.event.get(endpoint, { userId, params: { notificationId } }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(notification);
  });

  it("returns 502 when the UDP get push ID integration fails unexpectedly", async ({
    http,
    sdk,
  }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(500);

    const result = await handler(
      sdk.event.get(endpoint, { userId, params: { notificationId } }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(502);
    expect(result.body).toBe("");
  });

  it.for([
    { reason: "returns a bad request", upstream: 400, expected: 400 },
    { reason: "cannot find the notification", upstream: 404, expected: 404 },
    { reason: "is rate limited", upstream: 429, expected: 429 },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the UNS get notification by ID integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/users/push-id", { headers: { "User-Id": userId } })
        .reply(200, { pushId });
      http
        .gateway("uns")
        .get(`/notifications/${notificationId}`, {
          query: { externalUserID: pushId },
        })
        .reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, { userId, params: { notificationId } }),
        sdk.context({ secrets }),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );
});
