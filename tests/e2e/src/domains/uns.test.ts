import { STUB_DEFAULT_SUBJECT } from "@flex/testing/e2e";
import { config as udpConfig } from "@flex/udp-domain/config";
import {
  NotificationSchema,
  NotificationsResponseSchema,
  PatchNotificationBody,
} from "@flex/uns-domain";
import { config as unsConfig } from "@flex/uns-domain/config";
import { describe, expect } from "vitest";

import { it } from "../extend/it";
import { isDomainDeployed, isRouteDeployed } from "../utils/is-deployed";

const udpGetUsersDeployed = () =>
  isRouteDeployed(udpConfig, "GET /v1/users/me");

describe.runIf(isDomainDeployed(unsConfig))("UNS domain", () => {
  // These tests assert against a given user based on the contents of the dev database, so
  // we need to ensure the stub token generator always returns the same subject for consistency.
  it.override({ authSub: STUB_DEFAULT_SUBJECT });

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
          async ({ cloudfront, udpUser: _, authHeader }) => {
            const result = await cloudfront.client.get(endpoint, {
              headers: authHeader,
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
        async ({ cloudfront, udpUser: _, authHeader }) => {
          const result = await cloudfront.client.get(
            endpoint(mockNotificationId.valid),
            { headers: authHeader },
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
        authHeader,
      }) => {
        const result = await cloudfront.client.get(
          endpoint(mockNotificationId.notFound),
          { headers: authHeader },
        );

        expect(result.status).toBe(404);
      });
    });

    describe.runIf(
      isRouteDeployed(unsConfig, "DELETE /v1/notifications/:notificationId"),
    )("DELETE", () => {
      it("returns 401 when no auth is provided", async ({ cloudfront }) => {
        const result = await cloudfront.client.delete(
          endpoint(mockNotificationId.valid),
        );

        expect(result.status).toBe(401);
      });

      it("returns 404 when no not found", async ({
        cloudfront,
        authHeader,
      }) => {
        const result = await cloudfront.client.delete(
          endpoint(mockNotificationId.notFound),
          { headers: authHeader },
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
      it.runIf(udpGetUsersDeployed()).todo(
        "returns 202 when a notification status has been updated",
        async ({ cloudfront, udpUser: _, authHeader }) => {
          const result = await cloudfront.client.patch<
            PatchNotificationBody,
            unknown
          >(endpoint(mockNotificationId.valid), {
            headers: authHeader,
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
        authHeader,
      }) => {
        const result = await cloudfront.client.patch<
          PatchNotificationBody,
          unknown
        >(endpoint(mockNotificationId.notFound), {
          headers: authHeader,
          body: { Status: "READ" },
        });

        expect(result.status).toBe(404);
      });
    });
  });
});
