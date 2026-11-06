import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

import { config } from "../domain.config";

describe.runIf(isDomainDeployed(config))("First domain", () => {
  describe.runIf(isRouteDeployed(config, "GET /v1/greeting"))(
    "GET /v1/greeting",
    () => {
      it("rejects unauthenticated requests", async ({ cloudfront }) => {
        const result = await cloudfront.client.get("/first-domain/v1/greeting");

        expect(result.status).toBe(401);
      });

      it("returns 200 for an authenticated user", async ({
        cloudfront,
        authHeader,
      }) => {
        const result = await cloudfront.client.get(
          "/first-domain/v1/greeting",
          { headers: authHeader },
        );

        expect(result.status).toBe(200);
      });

      it("returns the expected response body structure", async ({
        cloudfront,
        authHeader,
      }) => {
        const result = await cloudfront.client.get(
          "/first-domain/v1/greeting",
          { headers: authHeader },
        );

        expect(result.status).toBe(200);
        expect(result.body).toStrictEqual({
          message: expect.any(String) as string,
          topicCount: expect.any(Number) as number,
        });
      });

      it("returns 'Hello' as the greeting message", async ({
        cloudfront,
        authHeader,
      }) => {
        const result = await cloudfront.client.get(
          "/first-domain/v1/greeting",
          { headers: authHeader },
        );

        expect(result.status).toBe(200);
        expect(result.body).toMatchObject({ message: "Hello" });
      });

      it("returns a non-negative topic count", async ({
        cloudfront,
        authHeader,
      }) => {
        const result = await cloudfront.client.get(
          "/first-domain/v1/greeting",
          { headers: authHeader },
        );

        expect(result.status).toBe(200);
        const body = result.body as { topicCount: number };
        expect(body.topicCount).toBeGreaterThanOrEqual(0);
      });
    },
  );
});
