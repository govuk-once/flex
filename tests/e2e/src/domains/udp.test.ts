import type {
  GetUserResponse,
  UpdateNotificationPreferencesOutboundResponse,
  UpdateNotificationPreferencesRequest,
} from "@flex/udp-domain";
import { config as udpConfig } from "@flex/udp-domain/config";
import { describe, expect, inject } from "vitest";

import { it } from "../extend/it";
import { isDomainDeployed, isRouteDeployed } from "../utils/is-deployed";

const udpGetUsersDeployed = () => isRouteDeployed(udpConfig, "GET /v1/users/me");
const udpCreateIdentityDeployed = () =>
  isRouteDeployed(udpConfig, "POST /v1/identity/:service/:id");
const udpDeleteIdentityDeployed = () =>
  isRouteDeployed(udpConfig, "DELETE /v1/identity/:service");

describe.runIf(isDomainDeployed(udpConfig)).sequential("UDP domain", () => {
  const { JWT } = inject("e2eEnv");

  const authorization = { Authorization: `Bearer ${JWT.VALID}` };
  const serviceId = "test-service-id";
  const service = "test-service";

  describe("/udp/v1/identity/:service", () => {
    const endpoint = `/udp/v1/identity/${service}`;

    describe.runIf(
      isRouteDeployed(udpConfig, "GET /v1/identity/:service") &&
        udpCreateIdentityDeployed() &&
        udpDeleteIdentityDeployed(),
    )("GET", () => {
      it("returns 200 with service identity true when linked", async ({
        cloudfront,
        withIdentityLink,
      }) => {
        await withIdentityLink(service, serviceId);

        const linkedResult = await cloudfront.client.get(endpoint, {
          headers: { ...authorization },
        });

        expect(linkedResult.status).toBe(200);
        expect(linkedResult.body).toStrictEqual({ linked: true });
      });

      it("returns 200 with service identity false when unlinked", async ({
        cloudfront,
        withCleanIdentity,
      }) => {
        await withCleanIdentity(service);

        const unlinkedResult = await cloudfront.client.get(endpoint, {
          headers: { ...authorization },
        });

        expect(unlinkedResult.status).toBe(200);
        expect(unlinkedResult.body).toStrictEqual({ linked: false });
      });
    });

    describe.runIf(
      isRouteDeployed(udpConfig, "DELETE /v1/identity/:service") &&
        udpCreateIdentityDeployed(),
    )("DELETE", () => {
      it("returns 204 when identity is unlinked successfully and 404 when trying to unlink the same service", async ({
        cloudfront,
        withIdentityLink,
      }) => {
        await withIdentityLink(service, serviceId);

        const resultUnlinked = await cloudfront.client.delete(endpoint, {
          headers: { ...authorization },
        });

        expect(resultUnlinked.status).toBe(204);

        const resultNotFound = await cloudfront.client.delete(endpoint, {
          headers: { ...authorization },
        });

        expect(resultNotFound.status).toBe(404);
      });
    });
  });

  describe("/udp/v1/identity/:service/:id", () => {
    const endpoint = `/udp/v1/identity/${service}`;

    describe.runIf(
      isRouteDeployed(udpConfig, "POST /v1/identity/:service/:id") &&
        udpDeleteIdentityDeployed(),
    )("POST", () => {
      it("handles the service identity lifecycle (Link, Re-link, and Idempotency)", async ({
        cloudfront,
        withCleanIdentity,
      }) => {
        await withCleanIdentity(service);

        const createResult = await cloudfront.client.post(
          `${endpoint}/${serviceId}`,
          { headers: { ...authorization } },
        );

        expect(createResult.status).toBe(201);

        const idempotentResult = await cloudfront.client.post(
          `${endpoint}/${serviceId}`,
          { headers: { ...authorization } },
        );

        expect(idempotentResult.status).toBe(204);

        const swapResult = await cloudfront.client.post(
          `${endpoint}/new-test-id-999`,
          { headers: { ...authorization } },
        );

        expect(swapResult.status).toBe(201);
      });
    });
  });

  describe("/udp/v1/users/me", () => {
    const endpoint = "/udp/v1/users/me";

    describe.runIf(isRouteDeployed(udpConfig, "GET /v1/users/me"))("GET", () => {
      it("returns 200 with user profile", async ({ cloudfront }) => {
        const result = await cloudfront.client.get<GetUserResponse>(endpoint, {
          headers: { ...authorization },
        });

        expect(result.status).toBe(200);
        expect(result.body).toStrictEqual({
          userId: expect.any(String) as string,
          notifications: {
            consentStatus: expect.any(String) as string,
            pushId: expect.any(String) as string,
          },
        });
      });
    });
  });

  describe("/udp/v1/users/me/notifications", () => {
    const endpoint = "/udp/v1/users/me/notifications";

    describe.runIf(
      isRouteDeployed(udpConfig, "PATCH /v1/users/me/notifications") &&
        udpGetUsersDeployed(),
    )("PATCH", () => {
      it("returns 200 with updated user notification preferences", async ({
        cloudfront,
        udpUser: _,
      }) => {
        const result = await cloudfront.client.patch<
          UpdateNotificationPreferencesRequest,
          UpdateNotificationPreferencesOutboundResponse
        >(endpoint, {
          headers: { ...authorization },
          body: { consentStatus: "accepted" },
        });

        expect(result.status).toBe(200);
        expect(result.body).toStrictEqual({
          consentStatus: "accepted",
          pushId: expect.any(String) as string,
        });
      });

      it.for([
        {
          body: { consentStatus: "invalid" },
          reason: "includes an unrecognised consent status",
        },
        { body: {}, reason: "is empty" },
      ])(
        "rejects request when body $reason",
        async ({ body }, { cloudfront }) => {
          const result = await cloudfront.client.patch(endpoint, {
            headers: { ...authorization },
            body,
          });

          expect(result.status).toBe(400);
        },
      );
    });
  });
});
