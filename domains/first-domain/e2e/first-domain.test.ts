import { isDomainDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

import { config } from "../domain.config";

describe.runIf(isDomainDeployed(config))("First domain", () => {
  it("rejects unauthenticated requests", async ({ cloudfront }) => {
    const result = await cloudfront.client.get("/first-domain/v1/greeting");

    expect(result.status).toBe(401);
  });

  it("returns 200 for an authenticated user", async ({
    cloudfront,
    authHeader,
  }) => {
    const result = await cloudfront.client.get("/first-domain/v1/greeting", {
      headers: authHeader,
    });

    expect(result.status).toBe(200);
  });
});
