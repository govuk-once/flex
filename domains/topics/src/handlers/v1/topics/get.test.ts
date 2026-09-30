import { it } from "@flex/testing";
import {
  createTopics,
  emptyTopics,
  singleTopic,
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
      .reply(200, createTopics(singleTopic));

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(singleTopic);
  });

  it("returns 200 with multiple selectedTopics", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/topics", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(200, createTopics());

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(createTopics());
  });

  it("returns 200 with empty selectedTopics", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/topics", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(200, createTopics(emptyTopics));

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(createTopics(emptyTopics));
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
    expect(JSON.parse(result.body)).toStrictEqual(createTopics(emptyTopics));
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
