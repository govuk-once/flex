import { it } from "@flex/testing";
import { notification, pushId, secrets, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/notifications", () => {
  const endpoint = "/notifications";

  it("returns 200 with a list of notifications", async ({ http, sdk }) => {
    const notifications = [notification];

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

  it("returns 502 when the UDP get push ID integration fails unexpectedly", async ({
    http,
    sdk,
  }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(500);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(502);
    expect(result.body).toBe("");
  });

  it("returns 502 when the UNS get notifications integration fails unexpectedly", async ({
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
    expect(result.body).toBe("");
  });
});
