import { createFixtureBuilder, it, userId } from "@flex/testing";
import { UserSearches } from "@schemas/search";
import { baseSearches, makeFilledSearches } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./delete";

describe("DELETE /v1/activity/searches/:term", () => {
  const endpoint = "/activity/searches";

  it("returns 201 when existing searches are updated to remove a term", async ({
    http,
    sdk,
  }) => {
    const userSearches = makeFilledSearches(10);
    const oldSearches = createFixtureBuilder<UserSearches>(userSearches);
    userSearches.searches.selectedSearches.pop();
    const newSearches = createFixtureBuilder<UserSearches>(userSearches);
    const firstUserTerm = userSearches.searches.selectedSearches[0];
    // @ts-expect-error - it thinks the entry may not be defined
    const firstTerm = firstUserTerm.term;

    http
      .gateway("udp")
      .post(endpoint, {
        headers: { "requesting-service-user-id": userId },
        body: newSearches,
      })
      .reply(200, newSearches);

    http
      .gateway("udp")
      .get(endpoint, {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(201, oldSearches);

    const result = await handler(
      sdk.event.delete("/activity/searches/:term", {
        auth: userId,
        params: { term: firstTerm },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });

  it("returns 201 when specified term is not in existing searches", async ({
    http,
    sdk,
  }) => {
    const userSearches = makeFilledSearches(10);
    const oldSearches = createFixtureBuilder<UserSearches>(userSearches);

    http
      .gateway("udp")
      .get(endpoint, {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(201, oldSearches);

    const result = await handler(
      sdk.event.delete("/activity/searches/:term", {
        auth: userId,
        params: { term: "a test term" },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });

  it("returns 201 when there are no existing searches", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(endpoint, {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(201, baseSearches);

    const result = await handler(
      sdk.event.delete("/activity/searches/:term", {
        auth: userId,
        params: { term: "a test term" },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });

  it("returns 502 when the UDP get searches integration fails", async ({
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
      sdk.event.delete("/activity/searches/:term", {
        auth: userId,
        params: { term: "xyz" },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });

  it("throws when the UDP post searches integration fails with 409", async ({
    http,
    sdk,
  }) => {
    const userSearches = makeFilledSearches(10);
    const oldSearches = createFixtureBuilder<UserSearches>(userSearches);
    userSearches.searches.selectedSearches.pop();
    const newSearches = createFixtureBuilder<UserSearches>(userSearches);
    const firstUserTerm = userSearches.searches.selectedSearches[0];
    // @ts-expect-error - it thinks the entry may not be defined
    const firstTerm = firstUserTerm.term;

    http
      .gateway("udp")
      .post(endpoint, {
        headers: { "requesting-service-user-id": userId },
        body: newSearches,
      })
      .reply(409);

    http
      .gateway("udp")
      .get(endpoint, {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(201, oldSearches);

    const result = await handler(
      sdk.event.delete("/activity/searches/:term", {
        auth: userId,
        params: { term: firstTerm },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(409);
  });

  it("throws when the UDP post searches integration fails with 502", async ({
    http,
    sdk,
  }) => {
    const userSearches = makeFilledSearches(10);
    const oldSearches = createFixtureBuilder<UserSearches>(userSearches);
    userSearches.searches.selectedSearches.pop();
    const newSearches = createFixtureBuilder<UserSearches>(userSearches);
    const firstUserTerm = userSearches.searches.selectedSearches[0];
    // @ts-expect-error - it thinks the entry may not be defined
    const firstTerm = firstUserTerm.term;

    http
      .gateway("udp")
      .post(endpoint, {
        headers: { "requesting-service-user-id": userId },
        body: newSearches,
      })
      .reply(502);

    http
      .gateway("udp")
      .get(endpoint, {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(201, oldSearches);

    const result = await handler(
      sdk.event.delete("/activity/searches/:term", {
        auth: userId,
        params: { term: firstTerm },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });

  it("returns when the UDP get searches integration returns a not found", async ({
    http,
    sdk,
  }) => {
    const userSearches = makeFilledSearches(10);
    userSearches.searches.selectedSearches.pop();
    const firstUserTerm = userSearches.searches.selectedSearches[0];
    // @ts-expect-error - it thinks the entry may not be defined
    const firstTerm = firstUserTerm.term;

    http
      .gateway("udp")
      .get(endpoint, {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(404);

    const result = await handler(
      sdk.event.delete("/activity/searches/:term", {
        auth: userId,
        params: { term: firstTerm },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
  });

  it("throws when the UDP get searches integration returns a 502", async ({
    http,
    sdk,
  }) => {
    const userSearches = makeFilledSearches(10);
    userSearches.searches.selectedSearches.pop();
    const firstUserTerm = userSearches.searches.selectedSearches[0];
    // @ts-expect-error - it thinks the entry may not be defined
    const firstTerm = firstUserTerm.term;

    http
      .gateway("udp")
      .get(endpoint, {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(502);

    const result = await handler(
      sdk.event.delete("/activity/searches/:term", {
        auth: userId,
        params: { term: firstTerm },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });

  it("returns when no search term provided", async ({ sdk }) => {
    const result = await handler(
      sdk.event.delete("/activity/searches/:term", {
        auth: userId,
        params: { term: "" },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
  });
});
