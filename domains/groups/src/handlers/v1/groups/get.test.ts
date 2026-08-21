import { it } from "@flex/testing";
import { GroupTypeSchema } from "@schemas/group";
import { group, pushId, secrets, userId, withSubgroup } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/groups", () => {
  const endpoint = "/groups";
  const groupWithSubgroup = withSubgroup(group);

  it("returns 200 with groups mapped as notification subscriptions", async ({
    http,
    sdk,
  }) => {
    const groups = [group, groupWithSubgroup];

    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId });

    http
      .gateway("uns")
      .get("/groups", { query: { pushID: pushId } })
      .reply(200, groups);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual([
      {
        ...group,
        Type: GroupTypeSchema.enum.NOTIFICATION,
      },
      {
        ...groupWithSubgroup,
        Type: GroupTypeSchema.enum.NOTIFICATION,
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
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual([]);
  });

  it.for([{ reason: "fails unexpectedly", upstream: 500, expected: 502 }])(
    "returns $expected when the UDP get push ID integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/users/push-id", { headers: { "User-Id": userId } })
        .reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, { auth: userId }),
        sdk.context({ secrets }),
      );

      expect(result.statusCode).toBe(expected);
    },
  );

  it.for([{ reason: "cannot find the route", upstream: 404, expected: 502 }])(
    "returns $expected when the UNS get groups integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/users/push-id", { headers: { "User-Id": userId } })
        .reply(200, { pushId });

      http
        .gateway("uns")
        .get("/groups", { query: { pushID: pushId } })
        .reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, { auth: userId }),
        sdk.context({ secrets }),
      );

      expect(result.statusCode).toBe(expected);
    },
  );
});
