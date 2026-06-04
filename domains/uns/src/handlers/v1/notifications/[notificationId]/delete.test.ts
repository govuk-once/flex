import { it } from "@flex/testing";
import { notificationId, pushId, secrets, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./delete";

describe("DELETE /v1/notifications/:notificationId", () => {
  const endpoint = `/notifications/${notificationId}`;

  it("returns 204 when the notification has been deleted", async ({
    http,
    sdk,
  }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId });
    http
      .gateway("uns")
      .delete(`/notifications/${notificationId}`, {
        query: { externalUserID: pushId },
      })
      .reply(204);

    const result = await handler(
      sdk.event.delete(endpoint, { userId, params: { notificationId } }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(204);
    expect(result.body).toBe("");
  });

  it.for([
    { reason: "returns a bad request", upstream: 400, expected: 400 },
    { reason: "cannot find the user's push ID", upstream: 404, expected: 404 },
    { reason: "is rate limited", upstream: 429, expected: 429 },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the UDP get push ID integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/users/push-id", { headers: { "User-Id": userId } })
        .reply(upstream);

      const result = await handler(
        sdk.event.delete(endpoint, { userId, params: { notificationId } }),
        sdk.context({ secrets }),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );

  it.for([
    { reason: "returns a bad request", upstream: 400, expected: 400 },
    { reason: "cannot find the notification", upstream: 404, expected: 404 },
    { reason: "is rate limited", upstream: 429, expected: 429 },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the UNS delete notification integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/users/push-id", { headers: { "User-Id": userId } })
        .reply(200, { pushId });
      http
        .gateway("uns")
        .delete(`/notifications/${notificationId}`, {
          query: { externalUserID: pushId },
        })
        .reply(upstream);

      const result = await handler(
        sdk.event.delete(endpoint, { userId, params: { notificationId } }),
        sdk.context({ secrets }),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );
});
