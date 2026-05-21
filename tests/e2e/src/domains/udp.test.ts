import type {
  GetUserResponse,
  UpdateNotificationPreferencesOutboundResponse,
  UpdateNotificationPreferencesRequest,
} from "@flex/udp-domain";
import { config as udpConfig } from "@flex/udp-domain/config";
import { describe, expect } from "vitest";

import { it } from "../extend/it";
import { isDomainDeployed, isRouteDeployed } from "../utils/is-deployed";

const udpGetUsersDeployed = () => isRouteDeployed(udpConfig, "GET /v1/users");
const udpCreateIdentityDeployed = () =>
  isRouteDeployed(udpConfig, "POST /v1/identity/:service/:id");
const udpDeleteIdentityDeployed = () =>
  isRouteDeployed(udpConfig, "DELETE /v1/identity/:service");

describe.runIf(isDomainDeployed(udpConfig))("UDP domain", () => {
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
        authHeader,
      }) => {
        await withIdentityLink(service, serviceId);

        const linkedResult = await cloudfront.client.get(endpoint, {
          headers: authHeader,
        });

        expect(linkedResult.status).toBe(200);
        expect(linkedResult.body).toStrictEqual({ linked: true });
      });

      it("returns 200 with service identity false when unlinked", async ({
        cloudfront,
        withCleanIdentity,
        authHeader,
      }) => {
        await withCleanIdentity(service);

        const unlinkedResult = await cloudfront.client.get(endpoint, {
          headers: authHeader,
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
        authHeader,
      }) => {
        await withIdentityLink(service, serviceId);

        const resultUnlinked = await cloudfront.client.delete(endpoint, {
          headers: authHeader,
        });

        expect(resultUnlinked.status).toBe(204);

        const resultNotFound = await cloudfront.client.delete(endpoint, {
          headers: authHeader,
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
        authHeader,
      }) => {
        await withCleanIdentity(service);

        const createResult = await cloudfront.client.post(
          `${endpoint}/${serviceId}`,
          { headers: authHeader },
        );

        expect(createResult.status).toBe(201);

        const idempotentResult = await cloudfront.client.post(
          `${endpoint}/${serviceId}`,
          { headers: authHeader },
        );

        expect(idempotentResult.status).toBe(204);

        const swapResult = await cloudfront.client.post(
          `${endpoint}/new-test-id-999`,
          { headers: authHeader },
        );

        expect(swapResult.status).toBe(201);
      });
    });
  });

  describe("/udp/v1/users", () => {
    const endpoint = "/udp/v1/users";

    describe.runIf(isRouteDeployed(udpConfig, "GET /v1/users"))("GET", () => {
      it("returns 200 with user profile", async ({
        cloudfront,
        authHeader,
      }) => {
        const result = await cloudfront.client.get<GetUserResponse>(endpoint, {
          headers: authHeader,
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

  describe("/udp/v1/users/notifications", () => {
    const endpoint = "/udp/v1/users/notifications";

    describe.runIf(
      isRouteDeployed(udpConfig, "PATCH /v1/users/notifications") &&
        udpGetUsersDeployed(),
    )("PATCH", () => {
      it("returns 200 with updated user notification preferences", async ({
        cloudfront,
        udpUser: _,
        authHeader,
      }) => {
        const result = await cloudfront.client.patch<
          UpdateNotificationPreferencesRequest,
          UpdateNotificationPreferencesOutboundResponse
        >(endpoint, {
          headers: authHeader,
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
        async ({ body }, { cloudfront, authHeader }) => {
          const result = await cloudfront.client.patch(endpoint, {
            headers: authHeader,
            body,
          });

          expect(result.status).toBe(400);
        },
      );
    });
  });
});
