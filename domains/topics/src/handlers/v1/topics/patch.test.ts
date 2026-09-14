import { it } from "@flex/testing";
import {
  selectedTopicsEmpty,
  selectedTopicsMultiple,
  userId,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./patch";

describe("PATCH /v1/topics", () => {
  const endpoint = "/topics";

  it("returns 204 when topics are updated", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .post("/topics", {
        headers: { "requesting-service-user-id": userId },
        body: selectedTopicsMultiple,
      })
      .reply(200, selectedTopicsMultiple);

    const result = await handler(
      sdk.event.patch(endpoint, { auth: userId, body: selectedTopicsMultiple }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(204);
    expect(result.body).toBe("");
  });

  it("returns 204 when clearing all topics with an empty array", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .post("/topics", {
        headers: { "requesting-service-user-id": userId },
        body: selectedTopicsEmpty,
      })
      .reply(200, selectedTopicsEmpty);

    const result = await handler(
      sdk.event.patch(endpoint, {
        auth: userId,
        body: selectedTopicsEmpty,
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(204);
    expect(result.body).toBe("");
  });

  it("returns 400 when the request body is invalid", async ({ sdk }) => {
    const result = await handler(
      sdk.event.patch(endpoint, { auth: userId, body: {} }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(400);
  });

  it("returns 502 when the UDP post topics integration fails", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .post("/topics", {
        headers: { "requesting-service-user-id": userId },
        body: selectedTopicsMultiple,
      })
      .reply(500);

    const result = await handler(
      sdk.event.patch(endpoint, { auth: userId, body: selectedTopicsMultiple }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });
});
