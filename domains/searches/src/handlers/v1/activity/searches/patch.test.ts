import { it, userId } from "@flex/testing";
import { SearchTerm } from "@schemas/search";
import { describe, expect } from "vitest";

import { handler } from "./patch";

describe("PATCH /v1/activity/searches", () => {
    const endpoint = "/activity/searches";

    const newSearchTerm: SearchTerm = {
        term: "a new search",
        timestamp: "2026-11-04T13:45:00Z",
    };

    it("returns 204 and new term when existing searches are updated", async ({
        http,
        sdk,
    }) => {
        const existingSearchTerm0: SearchTerm = {
            term: "existing search",
            timestamp: "2026-11-04T13:45:00Z",
        };
        const existingSearchTerm1: SearchTerm = {
            term: "existing search",
            timestamp: "2026-11-04T13:45:00Z",
        };

        http.gateway("udp")
            .post(endpoint, {
                headers: { "requesting-service-user-id": userId },
                body: {
                    searches: {
                        userSearches: [
                            existingSearchTerm0,
                            existingSearchTerm1,
                            newSearchTerm,
                        ],
                    },
                },
            })
            .reply(200, {
                searches: {
                    userSearches: [
                        existingSearchTerm0,
                        existingSearchTerm1,
                        newSearchTerm,
                    ],
                },
            });

        http.gateway("udp")
            .get(endpoint, {
                headers: { "requesting-service-user-id": userId },
            })
            .reply(200, {
                searches: {
                    userSearches: [existingSearchTerm0, existingSearchTerm1],
                },
            });

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
            sdk.context()
        );

        expect(result.statusCode).toBe(204);
        expect(result.body).toBe("");
    });

    it("returns 204 and new term when empty searches are updated", async ({
        http,
        sdk,
    }) => {
        const newSearchTerm: SearchTerm = {
            term: "a new search",
            timestamp: "2026-11-04T13:45:00Z",
        };

        http.gateway("udp")
            .post(endpoint, {
                headers: { "requesting-service-user-id": userId },
                body: {
                    searches: {
                        userSearches: [newSearchTerm],
                    },
                },
            })
            .reply(200, {
                searches: {
                    userSearches: [newSearchTerm],
                },
            });

        http.gateway("udp")
            .get(endpoint, {
                headers: { "requesting-service-user-id": userId },
            })
            .reply(200, {
                searches: {
                    userSearches: [],
                },
            });

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
            sdk.context()
        );

        expect(result.statusCode).toBe(204);
        expect(result.body).toBe("");
    });

    it("returns 204 without new term when existing searches are updated with too long term", async ({
        http,
        sdk,
    }) => {
        const existingSearchTerm: SearchTerm = {
            term: "existing search",
            timestamp: "2026-11-04T13:45:00Z",
        };

        const newSearchTerm: SearchTerm = {
            term: "a new search that is too long to be stored in the data store. oh it is very very long indeed. so long in fact that it might just wrap around the line. and it is full of garbage afgn jlri3qt42 v u928t jgrlt 42i regjflab feal",
            timestamp: "2026-11-04T13:45:00Z",
        };

        http.gateway("udp")
            .post(endpoint, {
                headers: { "requesting-service-user-id": userId },
                body: {
                    searches: {
                        userSearches: [existingSearchTerm],
                    },
                },
            })
            .reply(200, {
                searches: {
                    userSearches: [existingSearchTerm],
                },
            });

        http.gateway("udp")
            .get(endpoint, {
                headers: { "requesting-service-user-id": userId },
            })
            .reply(200, {
                searches: {
                    userSearches: [existingSearchTerm],
                },
            });

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
            sdk.context()
        );

        expect(result.statusCode).toBe(204);
        expect(result.body).toBe("");
    });

    it("returns 204 and replaces the oldest term with the new term when existing searches are updated and there are already the maximum held", async ({
        http,
        sdk,
    }) => {
        const existingSearchTerm0: SearchTerm = {
            term: "existing search",
            timestamp: "2026-11-04T13:45:00Z",
        };
        const existingSearchTerm1: SearchTerm = {
            term: "existing search",
            timestamp: "2026-11-04T13:45:00Z",
        };
        const existingSearchTerm2: SearchTerm = {
            term: "existing search",
            timestamp: "2026-11-04T13:45:00Z",
        };
        const existingSearchTerm3: SearchTerm = {
            term: "existing search",
            timestamp: "2026-11-04T13:45:00Z",
        };
        const existingSearchTerm4: SearchTerm = {
            term: "existing search",
            timestamp: "2026-11-04T13:45:00Z",
        };
        const existingSearchTerm5: SearchTerm = {
            term: "existing search",
            timestamp: "2026-11-04T13:45:00Z",
        };
        const existingSearchTerm6: SearchTerm = {
            term: "existing search",
            timestamp: "2026-11-04T13:45:00Z",
        };
        const existingSearchTerm7: SearchTerm = {
            term: "existing search",
            timestamp: "2026-11-04T13:45:00Z",
        };
        const existingSearchTerm8: SearchTerm = {
            term: "existing search",
            timestamp: "2026-11-04T13:45:00Z",
        };
        const existingSearchTerm9: SearchTerm = {
            term: "existing search",
            timestamp: "2026-11-04T13:45:00Z",
        };

        const newSearchTerm: SearchTerm = {
            term: "a new search",
            timestamp: "2026-11-04T13:45:00Z",
        };

        http.gateway("udp")
            .post(endpoint, {
                headers: { "requesting-service-user-id": userId },
                body: {
                    searches: {
                        userSearches: [
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
                        ],
                    },
                },
            })
            .reply(200, {
                searches: {
                    userSearches: [
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
                    ],
                },
            });

        http.gateway("udp")
            .get(endpoint, {
                headers: { "requesting-service-user-id": userId },
            })
            .reply(200, {
                searches: {
                    userSearches: [
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
                    ],
                },
            });

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
            sdk.context()
        );

        expect(result.statusCode).toBe(204);
        expect(result.body).toBe("");
    });

    it("returns 409 when UDP write timestamps are out-of-sequence", async ({
        http,
        sdk,
    }) => {
        http.gateway("udp")
            .post(endpoint, {
                headers: { "requesting-service-user-id": userId },
                body: {
                    searches: {
                        userSearches: [newSearchTerm],
                    },
                },
            })
            .reply(409);

        http.gateway("udp")
            .get(endpoint, {
                headers: { "requesting-service-user-id": userId },
            })
            .reply(200, {
                searches: {
                    userSearches: [],
                },
            });

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
            sdk.context()
        );

        expect(result.statusCode).toBe(409);
    });

    it("returns 502 when the UDP post searches integration fails", async ({
        http,
        sdk,
    }) => {
        http.gateway("udp")
            .post(endpoint, {
                headers: { "requesting-service-user-id": userId },
                body: {
                    searches: {
                        userSearches: [newSearchTerm],
                    },
                },
            })
            .reply(500);

        http.gateway("udp")
            .get(endpoint, {
                headers: { "requesting-service-user-id": userId },
            })
            .reply(200, {
                searches: {
                    userSearches: [],
                },
            });

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
            sdk.context()
        );

        expect(result.statusCode).toBe(502);
    });

    it("returns 502 when the UDP get searches integration fails", async ({
        http,
        sdk,
    }) => {
        http.gateway("udp")
            .get(endpoint, {
                headers: { "requesting-service-user-id": userId },
            })
            .reply(500);

        const result = await handler(
            sdk.event.patch(endpoint, { auth: userId, body: newSearchTerm }),
            sdk.context()
        );

        expect(result.statusCode).toBe(502);
    });
});
