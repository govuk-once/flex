import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import type { GetHelloResponse } from "@schemas/hello";
import { describe, expect } from "vitest";

import { config as helloConfig } from "../domain.config";

describe.runIf(isDomainDeployed(helloConfig))("hello domain", () => {
  describe("/v1/hello", () => {
    const endpoint = "/hello/v1/hello";

    describe.runIf(isRouteDeployed(helloConfig, "GET /v1/hello"))("GET", () => {
      it("returns 200 with response", async ({
        cloudfront,
        udpUser: _,
        authHeader,
      }) => {
        const expected: GetHelloResponse = { reponse: "Hello Lorenzo" };

        const result = await cloudfront.client.get<GetHelloResponse>(endpoint, {
          headers: authHeader,
        });

        expect(result.status).toBe(200);
        expect(result.body).toStrictEqual(expected);
      });

      it("returns 401 when no auth is provided", async ({ cloudfront }) => {
        const result = await cloudfront.client.get(endpoint);

        expect(result.status).toBe(401);
      });
    });
  });
});
