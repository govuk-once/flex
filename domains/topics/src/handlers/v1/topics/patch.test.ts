import { it } from "@flex/testing";
import { clearSelectionsRequest, topicsRequest, userId } from "@tests/fixtures";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./patch";

describe("PATCH /v1/topics", () => {
  const endpoint = "/topics";
  const lambdaRequestTime = new Date("2026-09-14T12:00:00.000Z");
  const requestedAt = lambdaRequestTime.toISOString();

  it.beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(lambdaRequestTime);

    return () => {
      vi.useRealTimers();
    };
  });

  it("returns 204 when topics are updated", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .post("/topics", {
        headers: {
          "requesting-service-user-id": userId,
          "requested-at": requestedAt,
        },
        body: topicsRequest,
      })
      .reply(200, topicsRequest);

    const result = await handler(
      sdk.event.patch(endpoint, { auth: userId, body: topicsRequest }),
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
        headers: {
          "requesting-service-user-id": userId,
          "requested-at": requestedAt,
        },
        body: clearSelectionsRequest,
      })
      .reply(200, clearSelectionsRequest);

    const result = await handler(
      sdk.event.patch(endpoint, {
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
        headers: {
          "requesting-service-user-id": userId,
          "requested-at": requestedAt,
        },
        body: topicsRequest,
      })
      .reply(500);

    const result = await handler(
      sdk.event.patch(endpoint, { auth: userId, body: topicsRequest }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });

  describe("UDP requested-at header error", () => {
    const lambdaRequestTimeInPast = new Date();
    lambdaRequestTimeInPast.setDate(lambdaRequestTime.getDate() - 1);

    beforeEach(() => {
      vi.setSystemTime(lambdaRequestTimeInPast);
    });

    it("returns 409 when the requested-at header is out of sync", async ({
      http,
      sdk,
    }) => {
      http
        .gateway("udp")
        .post("/topics", {
          headers: {
            "requesting-service-user-id": userId,
            "requested-at": lambdaRequestTimeInPast.toISOString(),
          },
          body: topicsRequest,
        })
        .reply(409);

      const result = await handler(
        sdk.event.patch(endpoint, { auth: userId, body: topicsRequest }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(409);
    });
  });
});
