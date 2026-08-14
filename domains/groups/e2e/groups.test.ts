import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import { config as udpConfig } from "@flex/udp-domain/config";
import { describe, expect } from "vitest";

import { config as groupsConfig } from "../domain.config";
import { GroupsRequestSchema, GroupsResponseSchema } from "../src";

const udpGetUsersDeployed = () =>
  isRouteDeployed(udpConfig, "GET /v1/users/me");

describe.runIf(isDomainDeployed(groupsConfig))("Groups domain", () => {
  const endpoint = "/groups/v1/groups";

  const group = {
    Namespace: "travel",
    Group: "test country",
    Subgroup: "test frequency",
    Type: "NOTIFICATION" as const,
  };

  describe("/groups/v1/groups", () => {
    describe.runIf(isRouteDeployed(groupsConfig, "GET /v1/groups"))(
      "GET",
      () => {
        it.runIf(udpGetUsersDeployed())(
          "returns 200 with the user's group subscriptions",
          async ({ cloudfront, udpUser: _, authHeader }) => {
            const result = await cloudfront.client.get(endpoint, {
              headers: authHeader,
            });

            expect(result.status).toBe(200);
            expect(GroupsResponseSchema.safeParse(result.body).success).toBe(
              true,
            );
          },
        );

        it("returns 401 when no auth is provided", async ({ cloudfront }) => {
          const result = await cloudfront.client.get(endpoint);

          expect(result.status).toBe(401);
        });
      },
    );

    describe.runIf(isRouteDeployed(groupsConfig, "POST /v1/groups"))(
      "POST",
      () => {
        it.runIf(udpGetUsersDeployed())(
          "returns 200 after joining a group",
          async ({ cloudfront, udpUser: _, authHeader }) => {
            const joinRequest = [
              {
                ...group,
                Action: "JOIN" as const,
              },
            ];

            expect(GroupsRequestSchema.safeParse(joinRequest).success).toBe(
              true,
            );

            const result = await cloudfront.client.post(endpoint, {
              headers: authHeader,
              body: joinRequest,
            });

            expect(result.status).toBe(200);
            expect(GroupsResponseSchema.safeParse(result.body).success).toBe(
              true,
            );

            expect(result.body).toEqual(
              expect.arrayContaining([expect.objectContaining(group)]),
            );
          },
        );

        it("returns 401 when no auth is provided", async ({ cloudfront }) => {
          const result = await cloudfront.client.post(endpoint, {
            body: [
              {
                ...group,
                Action: "JOIN",
              },
            ],
          });

          expect(result.status).toBe(401);
        });

        it.runIf(udpGetUsersDeployed())(
          "returns 400 when the request body is invalid",
          async ({ cloudfront, udpUser: _, authHeader }) => {
            const result = await cloudfront.client.post(endpoint, {
              headers: authHeader,
              body: [
                {
                  Namespace: "travel",
                  Group: "test country",
                  Type: "NOTIFICATION",
                },
              ],
            });

            expect(result.status).toBe(400);
          },
        );
      },
    );
  });
});
