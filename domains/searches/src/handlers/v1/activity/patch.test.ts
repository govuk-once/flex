import { it } from "@flex/testing";
import { createListOfSearches, createLongSearch, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./patch";

describe("PATCH /v1/activity/searches", () => {
    const endpoint = "/activity/searches";

    it("returns 204 when searches are updated", async ({ http, sdk }) => {
        const body = createListOfSearches()
        http
            .gateway("udp")
            .post("/activity/searches", {
                headers: { "requesting-service-user-id": userId },
                body,
            })
            .reply(204);

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: body }),
            sdk.context(),
        );

        expect(result.statusCode).toBe(204);
        expect(result.body).toBe("");
    });

    it.skip("returns 201 when search term is too long", async ({ http, sdk }) => {
        const body = createLongSearch()

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: body }),
            sdk.context(),
        );

        expect(result.statusCode).toBe(201);
        expect(result.body).toBe("");
    });

    it.skip("returns 400 when the request body is invalid", async ({ sdk }) => {
        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: {} }),
            sdk.context(),
        );

        expect(result.statusCode).toBe(400);
    });

    it.skip("returns 409 when UDP write timestamps are out-of-sequence", async ({
                                                                               http,
                                                                               sdk,
                                                                           }) => {
        http
            .gateway("udp")
            .post("/activity/searches", {
                headers: { "requesting-service-user-id": userId },
                body: createListOfSearches,
            })
            .reply(409);

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: createListOfSearches }),
            sdk.context(),
        );

        expect(result.statusCode).toBe(409);
    });

    it.skip("returns 502 when the UDP post searches integration fails", async ({
                                                                            http,
                                                                            sdk,
                                                                        }) => {
        http
            .gateway("udp")
            .post("/activity/searches", {
                headers: { "requesting-service-user-id": userId },
                body: createListOfSearches,
            })
            .reply(500);

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: createListOfSearches }),
            sdk.context(),
        );

        expect(result.statusCode).toBe(502);
    });
});
