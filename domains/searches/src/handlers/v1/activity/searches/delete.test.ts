import { it, userId } from "@flex/testing";
import {makeFilledSearches, newSearchTerm} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./delete";

describe("DELETE /v1/activity/searches", () => {
  const endpoint = "/activity/searches";

  it("returns 200 when existing searches are updated to remove all terms", async ({
    http,
    sdk,
  }) => {
    const userSearches = makeFilledSearches(10);
    userSearches.searches.selectedSearches.pop();

    http
      .gateway("udp")
      .post(endpoint, {
        headers: { "requesting-service-user-id": userId },
        body: {
          searches: {
            selectedSearches: [],
          },
        },
      })
      .reply(200);

    const result = await handler(
      sdk.event.delete(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });

  it("returns 409 when the UDP delete all searches integration fails", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .post(endpoint, {
        headers: { "requesting-service-user-id": userId },
        body: {
          searches: {
            selectedSearches: [],
          },
        },
      })
      .reply(409);

    const result = await handler(
      sdk.event.delete(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toBe("");
  });
});
