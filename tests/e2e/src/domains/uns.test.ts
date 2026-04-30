import { NotificationsResponseSchema } from "@flex/uns-domain";
import { describe, expect, inject } from "vitest";

import { PatchNotificationBody } from "../../../../domains/uns/src/schemas/notification";
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

  describe("PATCH /uns/v1/notifications/:notificationId/status", () => {
    const notificationId = "not-1";
    const endpoint = `/uns/v1/notifications/${notificationId}/status`;
    const notFoundEndpoint = `/uns/v1/notifications/NoNOTHere/status`;

    it("returns 202 when a notification status has been updated", async ({
      cloudfront,
      udpUser: _,
    }) => {
      const result = await cloudfront.client.patch<
        PatchNotificationBody,
        unknown
      >(endpoint, {
        headers: { ...authorization },
        body: { Status: "READ" },
      });

      expect(result.status).toBe(202);
    });

    it("returns 401 when no auth is provided", async ({ cloudfront }) => {
      const result = await cloudfront.client.patch<
        PatchNotificationBody,
        unknown
      >(endpoint, {
        body: { Status: "READ" },
      });
      expect(result.status).toBe(401);
    });

    it("returns 404 when a notification does not exist", async ({
      cloudfront,
    }) => {
      const result = await cloudfront.client.patch<
        PatchNotificationBody,
        unknown
      >(notFoundEndpoint, {
        headers: { ...authorization },
        body: { Status: "READ" },
      });
      expect(result.status).toBe(404);
    });
  });
});
