import { config } from "@domain";
import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import { SearchTerm, UserSearches } from "@schemas/search";
import { describe, expect } from "vitest";

describe.runIf(isDomainDeployed(config))("Searches domain", () => {
  const endpoint = "/personalisation/v1/activity/searches";

  describe.runIf(isRouteDeployed(config, "PATCH /v1/activity/searches"))(
    "PATCH",
    () => {
      const searchTerm: SearchTerm = {
        term: "A New Search 11",
        timestamp: "2026-11-04T13:45:00Z",
      };

      it("patch returns 201 with updated user searches", async ({
        cloudfront,
        udpUser: _,
        authHeader,
      }) => {
        const result = await cloudfront.client.patch(endpoint, {
          headers: authHeader,
          body: searchTerm,
        });

        expect(result.status).toBe(201);
        expect(result.body).toBeUndefined();
      });

      it("patch returns 401 when no auth is provided", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.patch(endpoint, {
          body: searchTerm,
        });

        expect(result.status).toBe(401);
      });
    },
  );

  describe.runIf(isRouteDeployed(config, "GET /v1/activity/searches"))(
    "GET",
    () => {
      it("get returns 200 with found user searches", async ({
        cloudfront,
        udpUser: _,
        authHeader,
      }) => {
        const result = await cloudfront.client.get(endpoint, {
          headers: authHeader,
        });

        expect(result.status).toBe(200);
        expect(result.body).toBeDefined();
      });

      it("get returns 401 when no auth is provided", async ({ cloudfront }) => {
        const result = await cloudfront.client.get(endpoint, {});

        expect(result.status).toBe(401);
      });
    },
  );

  describe.runIf(isRouteDeployed(config, "DELETE /v1/activity/searches/:term"))(
    "DELETE:term",
    () => {
      it("delete returns 201 for a found term and updates user searches; returns 200 for a not found term", async ({
        cloudfront,
        udpUser: _,
        authHeader,
      }) => {
        let result = await cloudfront.client.patch(endpoint, {
          headers: authHeader,
          body: {
            term: "A New Search xyz",
            timestamp: "2026-11-04T13:45:00Z",
          },
        });

        expect(result.status).toBe(201);

        result = await cloudfront.client.get(endpoint, {
          headers: authHeader,
        });

        expect(result.status).toBe(200);
        expect(result.body).toBeDefined();

        let userSearches: UserSearches = result.body as UserSearches;
        let searches: SearchTerm[] = userSearches.searches.selectedSearches;
        let numFoundSearches = searches.length;
        // @ts-expect-error - it thinks the entry may not be defined
        const termToDelete: SearchTerm = searches[0];

        result = await cloudfront.client.delete(
          `/personalisation/v1/activity/searches/${termToDelete.term}`,
          {
            headers: authHeader,
          },
        );

        expect(result.status).toBe(201);
        expect(result.body).toBeUndefined();

        result = await cloudfront.client.get(endpoint, {
          headers: authHeader,
        });

        expect(result.status).toBe(200);
        expect(result.body).toBeDefined();

        userSearches = result.body as UserSearches;
        searches = userSearches.searches.selectedSearches;

        expect(searches).toHaveLength(numFoundSearches - 1);
        expect(searches).not.toContain(termToDelete);
        numFoundSearches = searches.length;

        result = await cloudfront.client.delete(
          `/personalisation/v1/activity/searches/dummy`,
          {
            headers: authHeader,
          },
        );

        expect(result.status).toBe(200);
        expect(result.body).toBeUndefined();

        result = await cloudfront.client.get(endpoint, {
          headers: authHeader,
        });

        expect(result.status).toBe(200);
        expect(result.body).toBeDefined();

        userSearches = result.body as UserSearches;
        searches = userSearches.searches.selectedSearches;

        expect(searches).toHaveLength(numFoundSearches);
      });

      it("delete returns 401 when no auth is provided", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.delete(endpoint, {
          params: { term: "" },
        });

        expect(result.status).toBe(401);
      });

      it("delete returns 201 with updated user searches", async ({
        cloudfront,
        udpUser: _,
        authHeader,
      }) => {
        let result = await cloudfront.client.patch(endpoint, {
          headers: authHeader,
          body: {
            term: "A New Search uvw",
            timestamp: "2026-11-04T13:45:00Z",
          },
        });

        expect(result.status).toBe(201);

        result = await cloudfront.client.get(endpoint, {
          headers: authHeader,
        });

        expect(result.status).toBe(200);
        expect(result.body).toBeDefined();

        result = await cloudfront.client.delete(endpoint, {
          headers: authHeader,
        });

        expect(result.status).toBe(201);
        expect(result.body).toBeUndefined();

        result = await cloudfront.client.get(endpoint, {
          headers: authHeader,
        });

        expect(result.status).toBe(200);
        expect(result.body).toBeDefined();

        const userSearches = result.body as UserSearches;
        const searches = userSearches.searches.selectedSearches;

        expect(searches).toHaveLength(0);
      });

      it("delete returns 200 when no match can be found", async ({
        cloudfront,
        udpUser: _,
        authHeader,
      }) => {
        const result = await cloudfront.client.delete(
          `/personalisation/v1/activity/searches/xyz`,
          {
            headers: authHeader,
          },
        );

        expect(result.status).toBe(200);
        expect(result.body).toBeUndefined();
      });

      it("delete returns 401 when no auth is provided", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.delete(endpoint, {
          params: { term: "" },
        });

        expect(result.status).toBe(401);
      });
    },
  );

  describe.runIf(isRouteDeployed(config, "DELETE /v1/activity/searches"))(
    "DELETE",
    () => {
      const searchTerm: SearchTerm = {
        term: "A New Search 11",
        timestamp: "2026-11-04T13:45:00Z",
      };

      it("delete returns 201 with updated user searches", async ({
        cloudfront,
        udpUser: _,
        authHeader,
      }) => {
        let result = await cloudfront.client.patch(endpoint, {
          headers: authHeader,
          body: searchTerm,
        });

        expect(result.status).toBe(201);

        result = await cloudfront.client.get(endpoint, {
          headers: authHeader,
        });

        expect(result.status).toBe(200);
        expect(result.body).toBeDefined();

        result = await cloudfront.client.delete(endpoint, {
          headers: authHeader,
        });

        expect(result.status).toBe(201);
        expect(result.body).toBeUndefined();

        result = await cloudfront.client.get(endpoint, {
          headers: authHeader,
        });

        expect(result.status).toBe(200);
        expect(result.body).toBeDefined();

        const userSearches: UserSearches = result.body as UserSearches;
        const searches: SearchTerm[] = userSearches.searches.selectedSearches;

        expect(searches).toHaveLength(0);
      });

      it("delete returns 401 when no auth is provided", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.delete(endpoint, {
          params: { term: "" },
        });

        expect(result.status).toBe(401);
      });
    },
  );
});
