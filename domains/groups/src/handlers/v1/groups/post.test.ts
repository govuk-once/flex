import { it } from "@flex/testing";
import { GroupActionSchema, GroupTypeSchema } from "@schemas/group";
import { group, pushId, secrets, userId, withSubgroup } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./post";

describe("POST /v1/groups", () => {
  const endpoint = "/groups";
  const groupWithSubgroup = withSubgroup(group);

  const existingNotificationGroup = {
    Namespace: "travel",
    Group: "spain",
    Type: GroupTypeSchema.enum.NOTIFICATION,
  };

  const requestBody = [
    {
      ...group,
      Type: GroupTypeSchema.enum.NOTIFICATION,
      Action: GroupActionSchema.enum.JOIN,
    },
    {
      ...groupWithSubgroup,
      Type: GroupTypeSchema.enum.NOTIFICATION,
      Action: GroupActionSchema.enum.LEAVE,
    },
  ];

  const unsRequestBody = [
    { ...group, Action: GroupActionSchema.enum.JOIN },
    { ...groupWithSubgroup, Action: GroupActionSchema.enum.LEAVE },
  ];

  const unsResponse = [group, groupWithSubgroup];

  const expectedNotificationGroups = [
    { ...group, Type: GroupTypeSchema.enum.NOTIFICATION },
    { ...groupWithSubgroup, Type: GroupTypeSchema.enum.NOTIFICATION },
  ];

  it("returns 200 with notification groups when the user has no existing groups", async ({
    http,
    sdk,
  }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId });
    http
      .gateway("udp")
      .get("/groups", { headers: { "requesting-service-user-id": userId } })
      .reply(200, []);
    http
      .gateway("uns")
      .post("/groups", { query: { pushID: pushId }, body: unsRequestBody })
      .reply(200, unsResponse);
    http
      .gateway("udp")
      .post("/groups", {
        headers: { "requesting-service-user-id": userId },
        body: expectedNotificationGroups,
      })
      .reply(200, expectedNotificationGroups);

    const result = await handler(
      sdk.event.post(endpoint, { auth: userId, body: requestBody }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(expectedNotificationGroups);
  });

  it("returns 200 with notification groups replacing existing notification groups", async ({
    http,
    sdk,
  }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId });
    http
      .gateway("udp")
      .get("/groups", { headers: { "requesting-service-user-id": userId } })
      .reply(200, [existingNotificationGroup]);
    http
      .gateway("uns")
      .post("/groups", { query: { pushID: pushId }, body: unsRequestBody })
      .reply(200, unsResponse);
    http
      .gateway("udp")
      .post("/groups", {
        headers: { "requesting-service-user-id": userId },
        body: expectedNotificationGroups,
      })
      .reply(200, expectedNotificationGroups);

    const result = await handler(
      sdk.event.post(endpoint, { auth: userId, body: requestBody }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(expectedNotificationGroups);
  });

  it("returns 200 with an empty array when UNS returns empty and user has no existing groups", async ({
    http,
    sdk,
  }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId });
    http
      .gateway("udp")
      .get("/groups", { headers: { "requesting-service-user-id": userId } })
      .reply(200, []);
    http
      .gateway("uns")
      .post("/groups", { query: { pushID: pushId }, body: unsRequestBody })
      .reply(200, []);
    http
      .gateway("udp")
      .post("/groups", {
        headers: { "requesting-service-user-id": userId },
        body: [],
      })
      .reply(200, []);

    const result = await handler(
      sdk.event.post(endpoint, { auth: userId, body: requestBody }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual([]);
  });

  it("returns 200 treating a 404 from UDP get groups as an empty group list", async ({
    http,
    sdk,
  }) => {
    http
      .domain("udp")
      .get("/users/push-id", { headers: { "User-Id": userId } })
      .reply(200, { pushId });
    http
      .gateway("udp")
      .get("/groups", { headers: { "requesting-service-user-id": userId } })
      .reply(404);
    http
      .gateway("uns")
      .post("/groups", { query: { pushID: pushId }, body: unsRequestBody })
      .reply(200, unsResponse);
    http
      .gateway("udp")
      .post("/groups", {
        headers: { "requesting-service-user-id": userId },
        body: expectedNotificationGroups,
      })
      .reply(200, expectedNotificationGroups);

    const result = await handler(
      sdk.event.post(endpoint, { auth: userId, body: requestBody }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(expectedNotificationGroups);
  });

  it.for([{ reason: "fails unexpectedly", upstream: 500, expected: 502 }])(
    "returns $expected when the UDP get push ID integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/users/push-id", { headers: { "User-Id": userId } })
        .reply(upstream);

      const result = await handler(
        sdk.event.post(endpoint, { auth: userId, body: requestBody }),
        sdk.context({ secrets }),
      );

      expect(result.statusCode).toBe(expected);
    },
  );

  it.for([{ reason: "fails unexpectedly", upstream: 500, expected: 502 }])(
    "returns $expected when the UDP get groups integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/users/push-id", { headers: { "User-Id": userId } })
        .reply(200, { pushId });
      http
        .gateway("udp")
        .get("/groups", { headers: { "requesting-service-user-id": userId } })
        .reply(upstream);

      const result = await handler(
        sdk.event.post(endpoint, { auth: userId, body: requestBody }),
        sdk.context({ secrets }),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );

  it.for([{ reason: "fails unexpectedly", upstream: 500, expected: 502 }])(
    "returns $expected when the UNS post groups integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/users/push-id", { headers: { "User-Id": userId } })
        .reply(200, { pushId });
      http
        .gateway("udp")
        .get("/groups", { headers: { "requesting-service-user-id": userId } })
        .reply(200, []);
      http
        .gateway("uns")
        .post("/groups", { query: { pushID: pushId }, body: unsRequestBody })
        .reply(upstream);

      const result = await handler(
        sdk.event.post(endpoint, { auth: userId, body: requestBody }),
        sdk.context({ secrets }),
      );

      expect(result.statusCode).toBe(expected);
    },
  );

  it.for([{ reason: "fails unexpectedly", upstream: 500, expected: 502 }])(
    "returns $expected when the UDP post groups integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/users/push-id", { headers: { "User-Id": userId } })
        .reply(200, { pushId });
      http
        .gateway("udp")
        .get("/groups", { headers: { "requesting-service-user-id": userId } })
        .reply(200, []);
      http
        .gateway("uns")
        .post("/groups", { query: { pushID: pushId }, body: unsRequestBody })
        .reply(200, unsResponse);
      http
        .gateway("udp")
        .post("/groups", {
          headers: { "requesting-service-user-id": userId },
          body: expectedNotificationGroups,
        })
        .reply(upstream);

      const result = await handler(
        sdk.event.post(endpoint, { auth: userId, body: requestBody }),
        sdk.context({ secrets }),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );
});
