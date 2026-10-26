import { it } from "@flex/testing";
import {
  createSearch,
  emptySearches, multipleSearch,
  singleSearch,
  userId,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/activity/searches", () => {
  const endpoint = "/activity/searches";

  it("returns 200 with single selectedSearch", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/activity/searches", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(200, createSearch(singleSearch));

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(singleSearch);
  });

  it("returns 200 with multiple selected Searches", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/activity/searches", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(200, createSearch(multipleSearch));

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(multipleSearch);
  });

  it("returns 200 with empty selectedSearches", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/activity/searches", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(200, createSearch(emptySearches));

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(emptySearches);
  });

  it("returns 200 with empty selectedSearches when UDP user not found", async ({
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
    expect(JSON.parse(result.body)).toStrictEqual(emptySearches);
  });

  it("returns 502 when the UDP post searches integration fails", async ({
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
