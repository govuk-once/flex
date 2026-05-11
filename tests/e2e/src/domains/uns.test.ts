import { config as udpConfig } from "@flex/udp-domain/config";
import {
  NotificationSchema,
  NotificationsResponseSchema,
  PatchNotificationBody,
} from "@flex/uns-domain";
import { config as unsConfig } from "@flex/uns-domain/config";
import { describe, expect, inject } from "vitest";

import { it } from "../extend/it";
import { isDomainDeployed, isRouteDeployed } from "../utils/is-deployed";

const udpGetUsersDeployed = () => isRouteDeployed(udpConfig, "GET /v1/users");

describe.runIf(isDomainDeployed(unsConfig))("UNS domain", () => {
  const { JWT } = inject("e2eEnv");
  const authorization = { Authorization: `Bearer ${JWT.VALID}` };

  const mockNotificationId = {
    valid: "d4e04ac4-5696-45b7-8e8c-0060883a84f5",
    notFound: "unknown-notification-id",
  };

  describe("/uns/v1/notifications", () => {
    const endpoint = `/uns/v1/notifications`;

    describe.runIf(isRouteDeployed(unsConfig, "GET /v1/notifications"))(
      "GET",
      () => {
        it.runIf(udpGetUsersDeployed())(
          "returns 200 with users notifications",
          async ({ cloudfront, udpUser: _ }) => {
            const result = await cloudfront.client.get(endpoint, {
              headers: { ...authorization },
            });

            expect(result.status).toBe(200);
            expect(
              NotificationsResponseSchema.safeParse(result.body).success,
            ).toBe(true);
          },
        );

        it("returns 401 when no auth is provided", async ({ cloudfront }) => {
          const result = await cloudfront.client.get(endpoint);
          expect(result.status).toBe(401);
        });
      },
    );
  });

  describe("/uns/v1/notifications/:notificationId", () => {
    const endpoint = (id: string) => `/uns/v1/notifications/${id}`;

    describe.runIf(
      isRouteDeployed(unsConfig, "GET /v1/notifications/:notificationId"),
    )("GET", () => {
      it.runIf(udpGetUsersDeployed())(
        "returns 200 with notification details",
        async ({ cloudfront, udpUser: _ }) => {
          const result = await cloudfront.client.get(
            endpoint(mockNotificationId.valid),
            { headers: { ...authorization } },
          );

          expect(result.status).toBe(200);
          expect(NotificationSchema.safeParse(result.body).success).toBe(true);
        },
      );

      it("returns 401 when no auth is provided", async ({ cloudfront }) => {
        const result = await cloudfront.client.get(
          endpoint(mockNotificationId.valid),
        );

        expect(result.status).toBe(401);
      });

      it("returns 404 when a notification does not exist", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.get(
          endpoint(mockNotificationId.notFound),
          { headers: { ...authorization } },
        );

        expect(result.status).toBe(404);
      });
    });

    // TODO: Existing tests were calling GET endpoints for DELETE scenarios
    describe
      .runIf(
        isRouteDeployed(unsConfig, "DELETE /v1/notifications/:notificationId"),
      )
      .todo("DELETE", () => {
        it("returns 401 when no auth is provided", async ({ cloudfront }) => {
          const result = await cloudfront.client.delete(
            endpoint(mockNotificationId.valid),
          );

          expect(result.status).toBe(401);
        });

        it("returns 404 when no not found", async ({ cloudfront }) => {
          const result = await cloudfront.client.delete(
            endpoint(mockNotificationId.notFound),
            { headers: { ...authorization } },
          );

          expect(result.status).toBe(404);
        });
      });
  });

  describe("/uns/v1/notifications/:notificationId/status", () => {
    const endpoint = (id: string) => `/uns/v1/notifications/${id}/status`;

    describe.runIf(
      isRouteDeployed(
        unsConfig,
        "PATCH /v1/notifications/:notificationId/status",
      ),
    )("PATCH", () => {
      it.runIf(udpGetUsersDeployed())(
        "returns 202 when a notification status has been updated",
        async ({ cloudfront, udpUser: _ }) => {
          const result = await cloudfront.client.patch<
            PatchNotificationBody,
            unknown
          >(endpoint(mockNotificationId.valid), {
            headers: { ...authorization },
            body: { Status: "READ" },
          });

          expect(result.status).toBe(202);
        },
      );

      it("returns 401 when no auth is provided", async ({ cloudfront }) => {
        const result = await cloudfront.client.patch<
          PatchNotificationBody,
          unknown
        >(endpoint(mockNotificationId.valid), { body: { Status: "READ" } });

        expect(result.status).toBe(401);
      });

      it("returns 404 when a notification does not exist", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.patch<
          PatchNotificationBody,
          unknown
        >(endpoint(mockNotificationId.notFound), {
          headers: { ...authorization },
          body: { Status: "READ" },
        });

        expect(result.status).toBe(404);
      });
    });
  });
});
