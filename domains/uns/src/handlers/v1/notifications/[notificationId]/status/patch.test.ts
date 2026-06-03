import { it } from "@flex/testing";
import {
  notificationId,
  notificationStatus,
  pushId,
  secrets,
  userId,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./patch";

describe("PATCH /v1/notifications/:notificationId/status", () => {
  const endpoint = `/notifications/${notificationId}/status`;

  it("returns 202 when the notification status has been updated", async ({
    http,
    sdk,
  }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId });
    http
      .gateway("uns")
      .patch(`/notifications/${notificationId}/status`, {
        query: { externalUserID: pushId },
        body: { Status: notificationStatus },
      })
      .reply(202);

    const result = await handler(
      sdk.event.patch(endpoint, {
        userId,
        body: { Status: notificationStatus },
        params: { notificationId },
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(202);
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
        sdk.event.patch(endpoint, {
          userId,
          body: { Status: notificationStatus },
          params: { notificationId },
        }),
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
    "returns $expected when the UNS patch notification integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/users/push-id", { headers: { "User-Id": userId } })
        .reply(200, { pushId });
      http
        .gateway("uns")
        .patch(`/notifications/${notificationId}/status`, {
          query: { externalUserID: pushId },
          body: { Status: notificationStatus },
        })
        .reply(upstream);

      const result = await handler(
        sdk.event.patch(endpoint, {
          userId,
          body: { Status: notificationStatus },
          params: { notificationId },
        }),
        sdk.context({ secrets }),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );
});
