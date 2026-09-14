import { it } from "@flex/testing";
import {
  selectedTopicsEmpty,
  selectedTopicsMultiple,
  selectedTopicsSingle,
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
      .reply(200, selectedTopicsSingle);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(selectedTopicsSingle);
  });

  it("returns 200 with multiple selectedTopics", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/topics", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(200, selectedTopicsMultiple);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(selectedTopicsMultiple);
  });

  it("returns 200 with empty selectedTopics", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/topics", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(200, selectedTopicsEmpty);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(selectedTopicsEmpty);
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
    expect(JSON.parse(result.body)).toStrictEqual(selectedTopicsEmpty);
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
