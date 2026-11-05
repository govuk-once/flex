import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import {SearchTerm, UserSearches} from "@schemas/search";
import {createSearch} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { config as searchesConfig } from "../domain.config";

describe.runIf(isDomainDeployed(searchesConfig))("Searches domain", () => {
    describe("/searches/v1/activity/searches", () => {
        const endpoint = "/searches/v1/activity/searches";

        describe.runIf(
            isRouteDeployed(searchesConfig, "PATCH /v1/activity/searches")
        )("PATCH", () => {
            it("returns 204 with updated user searches", async ({
                cloudfront,
                udpUser: _,
                authHeader,
            }) => {
                const result = await cloudfront.client.patch<
                    SearchTerm,
                    UserSearches
                >(endpoint, {
                    headers: authHeader,
                    body: createSearch(),
                });

                expect(result.status).toBe(204);
            });

            it("returns 401 when no auth is provided", async ({
                cloudfront,
            }) => {
                const result = await cloudfront.client.patch<
                    SearchTerm,
                    UserSearches
                >(endpoint, {
                    body: createSearch(),
                });

                expect(result.status).toBe(401);
            });
        });
    });
});
