import { createFixtureBuilder, it, userId } from "@flex/testing";
import { SearchTerm, UserSearches } from "@schemas/search";
import {
  baseSearches,
  makeFilledSearches,
  makeSearchTerm,
  newSearchTerm,
  testSearchTermBase,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import {
  handler,
  limitArraySize,
  MAX_SEARCH_TERMS,
  removeDuplicates,
} from "./patch";

describe("PATCH /v1/activity/searches", () => {
  const endpoint = "/activity/searches";

  it("returns 201 and new term when existing searches are updated", async ({
    http,
    sdk,
  }) => {
    baseSearches.searches.selectedSearches.push(
      makeSearchTerm("search term 0"),
    );
    baseSearches.searches.selectedSearches.push(
      makeSearchTerm("search term 1"),
    );
    const oldSearches = createFixtureBuilder<UserSearches>(baseSearches);
    baseSearches.searches.selectedSearches.push(newSearchTerm);
    const newSearches = createFixtureBuilder<UserSearches>(baseSearches);

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
      sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });

  it("returns 201 and new term when no existing searches exist", async ({
    http,
    sdk,
  }) => {
    const emptySearches: UserSearches = {
      searches: {
        selectedSearches: [],
      },
    };
    emptySearches.searches.selectedSearches.push(newSearchTerm);
    const newSearches = createFixtureBuilder<UserSearches>(emptySearches);

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
      .reply(404);

    const result = await handler(
      sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });

  it("returns 201 and new term when empty searches are updated", async ({
    http,
    sdk,
  }) => {
    const newSearchTerm: SearchTerm = makeSearchTerm("a new search");

    const emptySearches: UserSearches = {
      searches: {
        selectedSearches: [],
      },
    };
    emptySearches.searches.selectedSearches.push(newSearchTerm);
    const newSearches = createFixtureBuilder<UserSearches>(emptySearches);

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
      .reply(201, emptySearches);

    const result = await handler(
      sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });

  it("returns 201, removes the oldest term and adds the new term when existing searches are updated and there are already the maximum held", async ({
    http,
    sdk,
  }) => {
    const userSearches = makeFilledSearches(10);
    const oldSearches = createFixtureBuilder<UserSearches>(userSearches);
    userSearches.searches.selectedSearches.push(newSearchTerm);
    const newSearches = createFixtureBuilder<UserSearches>(userSearches);

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
      sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });

  it("returns 201 and replaces and existing matching term with the new term when existing searches are updated", async ({
    http,
    sdk,
  }) => {
    const newSearchTerm: SearchTerm = makeSearchTerm("matchIng sEaRch Term");

    const baseSearches: UserSearches = {
      searches: {
        selectedSearches: [
          makeSearchTerm("search 0"),
          makeSearchTerm("MatChIng sEarch terM"),
          makeSearchTerm("search 2"),
          makeSearchTerm("search 3"),
          makeSearchTerm("search 4"),
        ],
      },
    };
    const oldSearches = createFixtureBuilder<UserSearches>(baseSearches);
    baseSearches.searches.selectedSearches.push(newSearchTerm);
    const newSearches = createFixtureBuilder<UserSearches>(baseSearches);

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
      sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });

  it("returns 400 without new term when existing searches are updated with too long term", async ({
    sdk,
  }) => {
    const newSearchTerm: SearchTerm = makeSearchTerm(
      "a new search that is too long to be stored in the data store. oh it is very very long indeed. so long in fact that it might just wrap around the line. and it is full of garbage afgn jlri3qt42 v u928t jgrlt 42i regjflab feal",
    );

    const result = await handler(
      sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(400);
  });

  it("returns 409 when UDP write timestamps are out-of-sequence", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .post(endpoint, {
        headers: { "requesting-service-user-id": userId },
        body: {
          searches: {
            selectedSearches: [newSearchTerm],
          },
        },
      })
      .reply(409);

    http
      .gateway("udp")
      .get(endpoint, {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(200, {
        searches: {
          selectedSearches: [],
        },
      });

    const result = await handler(
      sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(409);
  });

  it("returns 502 when the UDP post searches integration fails", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .post(endpoint, {
        headers: { "requesting-service-user-id": userId },
        body: {
          searches: {
            selectedSearches: [newSearchTerm],
          },
        },
      })
      .reply(500);

    http
      .gateway("udp")
      .get(endpoint, {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(200, {
        searches: {
          selectedSearches: [],
        },
      });

    const result = await handler(
      sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });

  it("returns 502 when the UDP get searches integration fails", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(endpoint, {
        headers: { "requesting-service-user-id": userId },
      })
      .reply(500);

    const result = await handler(
      sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });

  describe("Exercise PATCH utility processing", () => {
    const arrayLimit = MAX_SEARCH_TERMS;

    it("limitArraySize: removes the oldest term when there are already the maximum held", () => {
      const oldSearches = makeFilledSearches(arrayLimit);
      const oldestSearch = oldSearches.searches.selectedSearches[0];
      const newSearches = limitArraySize(
        oldSearches.searches.selectedSearches,
        arrayLimit,
      );

      expect(newSearches).toHaveLength(arrayLimit - 1);
      expect(newSearches).not.toContain(oldestSearch);
    });

    it("limitArraySize: leave array the same when there are less than the maximum held", () => {
      const oldSearches = makeFilledSearches(arrayLimit - 1);
      const oldestSearch = oldSearches.searches.selectedSearches[0];
      const newSearches = limitArraySize(
        oldSearches.searches.selectedSearches,
        arrayLimit,
      );

      expect(newSearches).toHaveLength(arrayLimit - 1);
      expect(newSearches).toContain(oldestSearch);
    });

    it("removeDuplicates: replaces any existing matching term with the new term when existing searches are updated", () => {
      const testIndex = 4;
      const oldSearches: UserSearches = makeFilledSearches(arrayLimit);
      const oldMatch = oldSearches.searches.selectedSearches[testIndex];
      const newSearch: SearchTerm = makeSearchTerm(
        `(${testSearchTermBase.toUpperCase()}) (${testIndex.toString()})`,
      );

      const newSearches = removeDuplicates(
        oldSearches.searches.selectedSearches,
        newSearch,
      );

      expect(newSearches).toHaveLength(arrayLimit - 1);
      expect(newSearches).not.toContain(oldMatch);
    });
  });
});
