import { it } from "@flex/testing";
import {
  clearSelectionsRequest,
  singleTopicResponse,
  topicsRequest,
  userId,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/topics", () => {
  const endpoint = "/topics";

  it("returns 200 with single selectedTopic", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/topics", {
        headers: { "requesting-service-user-id": userId },
      })
      // TODO: Rename var
      .reply(200, singleTopicResponse);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    // TODO: Rename var
    expect(JSON.parse(result.body)).toStrictEqual(singleTopicResponse);
  });

  it("returns 200 with multiple selectedTopics", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/topics", {
        headers: { "requesting-service-user-id": userId },
      })
      // TODO: Rename var
      .reply(200, topicsRequest);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    // TODO: Rename var
    expect(JSON.parse(result.body)).toStrictEqual(topicsRequest);
  });

  it("returns 200 with empty selectedTopics", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/topics", {
        headers: { "requesting-service-user-id": userId },
      })
      // TODO: Rename var
      .reply(200, clearSelectionsRequest);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    // TODO: Rename var
    expect(JSON.parse(result.body)).toStrictEqual(clearSelectionsRequest);
  });

  it("returns 200 with empty selectedTopics when UDP user not found", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get("/topics", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(404);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    // TODO: Rename var
    expect(JSON.parse(result.body)).toStrictEqual(clearSelectionsRequest);
  });

  it("returns 502 when the UDP post topics integration fails", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get("/topics", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(500);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });
});
