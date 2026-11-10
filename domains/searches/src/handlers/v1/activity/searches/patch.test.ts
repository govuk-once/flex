import { createFixtureBuilder, it, userId } from "@flex/testing";
import { SearchTerm, UserSearches } from "@schemas/search";
import {
  baseSearches,
  existingSearchTerm0,
  existingSearchTerm1,
  existingSearchTerm2,
  existingSearchTerm3,
  existingSearchTerm4,
  existingSearchTerm5,
  existingSearchTerm6,
  existingSearchTerm7,
  existingSearchTerm8,
  existingSearchTerm9,
  newSearchTerm,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./patch";

describe("PATCH /v1/activity/searches", () => {
  const endpoint = "/activity/searches";

  it("returns 201 and new term when existing searches are updated", async ({
    http,
    sdk,
  }) => {
    baseSearches.searches.selectedSearches.push(existingSearchTerm0);
    baseSearches.searches.selectedSearches.push(existingSearchTerm1);
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
    const newSearchTerm: SearchTerm = {
      term: "a new search",
      timestamp: "2026-11-04T13:45:00Z",
    };

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
    baseSearches.searches.selectedSearches.push(existingSearchTerm0);
    baseSearches.searches.selectedSearches.push(existingSearchTerm1);
    baseSearches.searches.selectedSearches.push(existingSearchTerm2);
    baseSearches.searches.selectedSearches.push(existingSearchTerm3);
    baseSearches.searches.selectedSearches.push(existingSearchTerm4);
    baseSearches.searches.selectedSearches.push(existingSearchTerm5);
    baseSearches.searches.selectedSearches.push(existingSearchTerm6);
    baseSearches.searches.selectedSearches.push(existingSearchTerm7);
    baseSearches.searches.selectedSearches.push(existingSearchTerm8);
    baseSearches.searches.selectedSearches.push(existingSearchTerm9);
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

  it("returns 201 and replaces and existing matching term with the new term when existing searches are updated", async ({
    http,
    sdk,
  }) => {
    const existingSearchTerm0: SearchTerm = {
      term: "existing search 0",
      timestamp: "2026-11-04T13:45:00Z",
    };
    const existingSearchTerm1: SearchTerm = {
      term: "existing search 1",
      timestamp: "2026-11-04T13:45:00Z",
    };
    const existingSearchTerm2: SearchTerm = {
      term: "MatChIng sEarch terM",
      timestamp: "2026-11-04T13:45:00Z",
    };
    const existingSearchTerm3: SearchTerm = {
      term: "existing search 3",
      timestamp: "2026-11-04T13:45:00Z",
    };
    const existingSearchTerm4: SearchTerm = {
      term: "existing search 4",
      timestamp: "2026-11-04T13:45:00Z",
    };

    const newSearchTerm: SearchTerm = {
      term: "matchIng sEaRch Term",
      timestamp: "2026-11-04T13:45:00Z",
    };

    const baseSearches: UserSearches = {
      searches: {
        selectedSearches: [
          existingSearchTerm0,
          existingSearchTerm1,
          existingSearchTerm2,
          existingSearchTerm3,
          existingSearchTerm4,
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
    const newSearchTerm: SearchTerm = {
      term: "a new search that is too long to be stored in the data store. oh it is very very long indeed. so long in fact that it might just wrap around the line. and it is full of garbage afgn jlri3qt42 v u928t jgrlt 42i regjflab feal",
      timestamp: "2026-11-04T13:45:00Z",
    };

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
});
