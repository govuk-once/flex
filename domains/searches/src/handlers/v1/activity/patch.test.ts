import { it } from "@flex/testing";
import { createSearch, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./patch";

describe("PATCH /v1/activity/searches", () => {
    const endpoint = "/activity/searches";

    it("returns 204 when searches are updated", async ({ http, sdk }) => {
        http
            .gateway("udp")
            .post("/activity/searches", {
                headers: { "requesting-service-user-id": userId },
                body: createSearch(),
            })
            .reply(200, createSearch());

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: createSearch() }),
            sdk.context(),
        );

        expect(result.statusCode).toBe(204);
        expect(result.body).toBe("");
    });

    it("returns 204 when clearing all searches with an empty array", async ({
                                                                              http,
                                                                              sdk,
                                                                          }) => {
        const emptySearches = { searches: { selectedSearches: [] } };

        http
            .gateway("udp")
            .post("/activity/searches", {
                headers: { "requesting-service-user-id": userId },
                body: createSearch(emptySearches),
            })
            .reply(200, createSearch(emptySearches));

        const result = await handler(
            sdk.event.patch(endpoint, {
                auth: userId,
                body: createSearch(emptySearches),
            }),
            sdk.context(),
        );

        expect(result.statusCode).toBe(204);
        expect(result.body).toBe("");
    });

    it("returns 400 when the request body is invalid", async ({ sdk }) => {
        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: {} }),
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
            .post("/activity/searches", {
                headers: { "requesting-service-user-id": userId },
                body: createSearch(),
            })
            .reply(409);

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: createSearch() }),
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
            .post("/activity/searches", {
                headers: { "requesting-service-user-id": userId },
                body: createSearch(),
            })
            .reply(500);

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: createSearch() }),
            sdk.context(),
        );

        expect(result.statusCode).toBe(502);
    });
});
