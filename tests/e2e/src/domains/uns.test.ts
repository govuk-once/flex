import { NotificationsResponseSchema } from "@flex/uns-domain";
import { describe, expect, inject } from "vitest";

import { it } from "../extend/it";

describe("UNS domain", () => {
  const { JWT } = inject("e2eEnv");
  const authorization = { Authorization: `Bearer ${JWT.VALID}` };

  describe("GET /uns/v1/notifications", () => {
    const endpoint = `/uns/v1/notifications`;

    it("returns 200 for GET all notifications", async ({
      cloudfront,
      udpUser: _,
    }) => {
      const result = await cloudfront.client.get(endpoint, {
        headers: { ...authorization },
      });

      expect(result.status).toBe(200);

      const validation = NotificationsResponseSchema.safeParse(result.body);
      expect(validation.success).toBe(true);
    });

    it("returns 401 when no auth is provided", async ({ cloudfront }) => {
      const result = await cloudfront.client.get(endpoint);
      expect(result.status).toBe(401);
    });
  });
});
