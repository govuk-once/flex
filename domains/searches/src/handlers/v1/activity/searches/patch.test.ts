import {createUserId, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./patch";
import {SearchTerm} from "@schemas/search";

export const userId = createUserId("test-topics-user");

describe("PATCH /v1/activity/searches", () => {
    const endpoint = "/activity/searches";

    it("returns 204 when searches are updated", async ({ http, sdk }) => {
        const search: SearchTerm = {
            term: "a search",
            timestamp: "2026-11-04T13:45:00Z",
        };

        http
          .gateway("udp")
          .post("/activity/searches", {
              headers: { "requesting-service-user-id": userId },
              body: {
                  searches: {
                      userSearches: [
                          { term: "a search", timestamp: "2026-11-04T13:45:00Z" },
                      ],
                  },
              },
          })
          .reply(
            200,
            {
                searches: {
                    userSearches: [
                        { term: "search 1", timestamp: "2026-11-04T13:45:00Z" },
                        { term: "a search", timestamp: "2026-11-04T13:45:00Z" },
                    ],
                },
            },
          );

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: search }),
            sdk.context()
        );

        expect(result.statusCode).toBe(204);
        expect(result.body).toBe("");
    });
});
