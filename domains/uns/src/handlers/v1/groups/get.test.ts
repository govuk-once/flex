import { it } from "@flex/testing";
import { group, groupWithoutSubgroup, pushId, secrets, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/groups", () => {
  const endpoint = "/groups";

  it("returns 200 with groups mapped as notification subscriptions", async ({
    http,
    sdk,
  }) => {
    const groups = [group, groupWithoutSubgroup];

    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId });

    http
      .gateway("uns")
      .get("/groups", { query: { pushID: pushId } })
      .reply(200, groups);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual([
      {
        ...group,
        Type: "NOTIFICATION",
      },
      {
        ...groupWithoutSubgroup,
        Type: "NOTIFICATION",
      },
    ]);
  });

  it("returns 200 with an empty array when the user has no active groups", async ({
    http,
    sdk,
  }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId });

    http
      .gateway("uns")
      .get("/groups", { query: { pushID: pushId } })
      .reply(200, []);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual([]);
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

  it("returns 502 when the UNS get groups integration fails unexpectedly", async ({
    http,
    sdk,
  }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId });

    http
      .gateway("uns")
      .get("/groups", { query: { pushID: pushId } })
      .reply(404);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(502);
    expect(result.body).toBe("");
  });
});