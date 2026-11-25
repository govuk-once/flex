import { it, userId } from "@flex/testing";
import { UserSearches } from "@schemas/search";
import {
  baseSearches,
  createSearches,
  makeFilledSearches,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/activity/searches", () => {
  const endpoint = "/activity/searches";

  it("returns 200 with single selectedSearch", async ({ http, sdk }) => {
    const foundSearches: UserSearches = createSearches(makeFilledSearches(1));
    http
      .gateway("udp")
      .get("/activity/searches", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(200, foundSearches);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(foundSearches);
  });

  it("returns 200 with empty searches", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get("/activity/searches", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(200, createSearches(baseSearches));

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(baseSearches);
  });

  it("returns 200 with multiple searches", async ({ http, sdk }) => {
    const selectedTerms = makeFilledSearches(3);
    http
      .gateway("udp")
      .get("/activity/searches", {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(200, createSearches(selectedTerms));

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(selectedTerms);
  });

  it("returns 200 with empty searches when UDP user not found", async ({
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
    expect(JSON.parse(result.body)).toStrictEqual(baseSearches);
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
