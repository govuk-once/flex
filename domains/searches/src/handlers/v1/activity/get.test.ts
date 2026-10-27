import { it } from "@flex/testing";
import {
  createEmptySearch,
  createListOfSearches,
  createListOfSingleSearch,
  userId,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/activity/searches", () => {
  const endpoint = "/activity/searches";

  it.skip("returns 200 with single selectedSearch", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/activity/searches", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(200, createListOfSingleSearch);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(createListOfSingleSearch);
  });

  it.skip("returns 200 with multiple selected Searches", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/activity/searches", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(200, createListOfSearches);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(createListOfSearches);
  });

  it.skip("returns 200 with empty selectedSearches", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/activity/searches", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(200, createEmptySearch);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(createEmptySearch);
  });

  it.skip("returns 200 with empty selectedSearches when UDP user not found", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get("/activity/searches", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(404);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(createEmptySearch);
  });

  it.skip("returns 502 when the UDP post searches integration fails", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get("/activity/searches", {
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
