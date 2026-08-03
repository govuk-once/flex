import { it } from "@flex/testing";
import { group, pushId, secrets, userId, withSubgroup } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./post";

describe("POST /v1/groups", () => {
  const endpoint = "/groups";
  const groupWithSubgroup = withSubgroup(group);

  const requestBody = [
    {
      ...group,
      Type: "NOTIFICATION" as const,
      Action: "JOIN" as const,
    },
    {
      ...groupWithSubgroup,
      Type: "NOTIFICATION" as const,
      Action: "LEAVE" as const,
    },
  ];

  const unsRequestBody = [
    {
      ...group,
      Action: "JOIN" as const,
    },
    {
      ...groupWithSubgroup,
      Action: "LEAVE" as const,
    },
  ];

  const unsResponse = [group, groupWithSubgroup];

  it("returns 200 with the user's active groups", async ({ http, sdk }) => {
    http
      .domain("udp")
      .get("/users/push-id", {
        headers: {
          "User-Id": userId,
        },
      })
      .reply(200, { pushId });

    http
      .gateway("uns")
      .post("/groups", {
        query: {
          pushID: pushId,
        },
        body: unsRequestBody,
      })
      .reply(200, unsResponse);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        body: requestBody,
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);

    expect(JSON.parse(result.body)).toStrictEqual([
      {
        ...group,
        Type: "NOTIFICATION",
      },
      {
        ...groupWithSubgroup,
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
      .get("/users/push-id", {
        headers: {
          "User-Id": userId,
        },
      })
      .reply(200, { pushId });

    http
      .gateway("uns")
      .post("/groups", {
        query: {
          pushID: pushId,
        },
        body: unsRequestBody,
      })
      .reply(200, []);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        body: requestBody,
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual([]);
  });

  it("returns 502 when the UDP get push ID integration fails unexpectedly", async ({ http, sdk }) => {
    http
      .domain("udp")
      .get("/users/push-id", {
        headers: {
          "User-Id": userId,
        },
      })
      .reply(500);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        body: requestBody,
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(502);
  });

  it("returns 502 when posting groups to UNS fails", async ({ http, sdk }) => {
    http
      .domain("udp")
      .get("/users/push-id", {
        headers: {
          "User-Id": userId,
        },
      })
      .reply(200, { pushId });

    http
      .gateway("uns")
      .post("/groups", {
        query: {
          pushID: pushId,
        },
        body: unsRequestBody,
      })
      .reply(500);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        body: requestBody,
      }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(502);
  });
});
