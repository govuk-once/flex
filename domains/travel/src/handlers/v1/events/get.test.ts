import { it } from "@flex/testing";
import { events, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/events", () => {
  const endpoint = "/v1/events";

  it("returns 200 with the recent events from the travel gateway", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("travel")
      .get("/events", { query: { namespace: "travel", group: "france" } })
      .reply(200, events);

    const result = await handler(
      sdk.event.get(endpoint, {
        auth: userId,
        query: { namespace: "travel", group: "france" },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(events);
  });

  it("returns 200 with an empty list when no event found", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("travel")
      .get("/events", { query: { namespace: "travel", group: "spain" } })
      .reply(200, []);

    const result = await handler(
      sdk.event.get(endpoint, {
        auth: userId,
        query: { namespace: "travel", group: "spain" },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual([]);
  });

  it.for([
    { reason: "returns a client error", upstream: 404 },
    { reason: "fails unexpectedly", upstream: 500 },
  ])(
    "returns 502 when the travel gateway $reason",
    async ({ upstream }, { http, sdk }) => {
      http
        .gateway("travel")
        .get("/events", { query: { namespace: "travel", group: "france" } })
        .reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, {
          auth: userId,
          query: { namespace: "travel", group: "france" },
        }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(502);
    },
  );
});
