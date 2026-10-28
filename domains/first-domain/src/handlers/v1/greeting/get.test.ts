import { createUserId, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

const userId = createUserId("test-user");

describe("GET /v1/greeting", () => {
  it("returns the expected response shape", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/topics", { headers: { "requesting-service-user-id": userId } })
      .reply(200, {
        topics: { selectedTopics: [{ id: "topic-1", title: "Topic One" }] },
      });

    const result = await handler(
      sdk.event.get("/greeting", { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({
      message: "Hello",
      topicCount: 1,
    });
  });

  it("returns 502 when the gateway fails", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/topics", { headers: { "requesting-service-user-id": userId } })
      .reply(500, {});

    const result = await handler(
      sdk.event.get("/greeting", { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });
});
