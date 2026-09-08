import { it } from "@flex/testing";
import { clearSelectionsRequest, topicsRequest, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./post";

describe("POST /v1/topics", () => {
  const endpoint = "/topics";

  it("returns 204 when topics are updated", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .post("/topics", {
        headers: { "requesting-service-user-id": userId },
        body: topicsRequest,
      })
      .reply(200, topicsRequest);

    const result = await handler(
      sdk.event.post(endpoint, { auth: userId, body: topicsRequest }),
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
        body: clearSelectionsRequest,
      })
      .reply(200, clearSelectionsRequest);

    const result = await handler(
      sdk.event.post(endpoint, {
        auth: userId,
        body: clearSelectionsRequest,
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(204);
    expect(result.body).toBe("");
  });

  it("returns 400 when the request body is invalid", async ({ sdk }) => {
    const result = await handler(
      sdk.event.post(endpoint, { auth: userId, body: {} }),
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
        body: topicsRequest,
      })
      .reply(500);

    const result = await handler(
      sdk.event.post(endpoint, { auth: userId, body: topicsRequest }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });
});
