import { it } from "@flex/testing";
import { createSearch, createSearches, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./patch";

describe("PATCH /v1/activity/searches", () => {
    const endpoint = "/activity/searches";

    it("returns 204 when searches are updated", async ({ http, sdk }) => {
        http.gateway("udp")
            .post("/activity/searches", {
                headers: { "requesting-service-user-id": userId },
                body: createSearches(),
            })
            .reply(200, createSearch());

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: createSearch() }),
            sdk.context()
        );

        expect(result.statusCode).toBe(204);
        expect(result.body).toBe("");
    });
});
