import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { it, STUB_DEFAULT_SUBJECT } from "@flex/testing/e2e";
import type {
  UpdateNotificationPreferencesOutboundResponse,
  UpdateNotificationPreferencesRequest,
} from "@flex/udp-domain";
import { config as udpConfig } from "@flex/udp-domain/config";
import { NotificationsResponseSchema } from "@flex/uns-domain";
import { config as unsConfig } from "@flex/uns-domain/config";
import { describe, expect } from "vitest";

import { config as exampleConfig } from "../domain.config";

// TODO: Fine for now, but need a better solution for tests with cross-domain dependencies
const udpGetUsersDeployed = () =>
  isRouteDeployed(udpConfig, "GET /v1/users/me");
const udpGetPushIdDeployed = () =>
  isRouteDeployed(udpConfig, "GET /v1/users/push-id [private]");
const udpCreateIdentityDeployed = () =>
  isRouteDeployed(udpConfig, "POST /v1/identity/:service");
const udpDeleteIdentityDeployed = () =>
  isRouteDeployed(udpConfig, "DELETE /v1/identity/:service");

const unsGetNotificationsDeployed = () =>
  isRouteDeployed(unsConfig, "GET /v1/notifications");

describe.runIf(isDomainDeployed(exampleConfig))("Example domain", () => {
  // These tests assert against a given user based on the contents of the dev database, so
  // we need to ensure the stub token generator always returns the same subject for consistency.
  it.override({ authSub: STUB_DEFAULT_SUBJECT });

  describe("/example/v0/todos", () => {
    const endpoint = "/example/v0/todos";

    describe.runIf(isRouteDeployed(exampleConfig, "GET /v0/todos"))(
      "GET",
      () => {
        it("returns 200 with list of todos", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.get(endpoint, {
            headers: authHeader,
          });

          expect(result.status).toBe(200);
          expect(result.body).toStrictEqual({
            todos: expect.any(Array) as unknown[],
            total: expect.any(Number) as number,
          });
        });

        it("returns 200 with filtered results", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.get(
            `${endpoint}?priority=low&limit=1`,
            { headers: authHeader },
          );

          expect(result.status).toBe(200);
          expect(result.body).toMatchObject({
            todos: expect.any(Array) as unknown[],
            total: expect.any(Number) as number,
          });
        });
      },
    );
  });

  describe("/example/v0/todos/:id", () => {
    const endpoint = (id = "todo-1") => `/example/v0/todos/${id}`;

    describe.runIf(isRouteDeployed(exampleConfig, "GET /v0/todos/:id"))(
      "GET",
      () => {
        it("returns 200 with existing todo", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.get(endpoint(), {
            headers: authHeader,
          });

          expect(result.status).toBe(200);
          expect(result.body).toMatchObject({
            id: expect.any(String) as string,
            title: expect.any(String) as string,
            completed: expect.any(Boolean) as boolean,
            priority: expect.any(String) as string,
            createdAt: expect.any(String) as string,
          });
        });
      },
    );
  });

  describe("/example/v0/todos/:id/duplicate", () => {
    const endpoint = (id = "todo-1") => `/example/v0/todos/${id}/duplicate`;

    describe.runIf(
      isRouteDeployed(exampleConfig, "POST /v0/todos/:id/duplicate"),
    )("POST", () => {
      it("returns 201 with duplicated todo", async ({
        cloudfront,
        authHeader,
      }) => {
        const result = await cloudfront.client.post(endpoint(), {
          headers: authHeader,
        });

        expect(result.status).toBe(201);
        expect(result.body).toMatchObject({
          id: expect.any(String) as string,
          title: expect.stringContaining("(copy)") as string,
          completed: false,
          priority: expect.any(String) as string,
          createdAt: expect.any(String) as string,
        });
      });
    });
  });

  describe("/example/v0/headers", () => {
    const endpoint = "/example/v0/headers";

    describe.runIf(isRouteDeployed(exampleConfig, "GET /v0/headers"))(
      "GET",
      () => {
        it("returns 200 with resolved headers", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.get(endpoint, {
            headers: {
              ...authHeader,
              "x-example-id": "example-123",
              "x-request-id": "request-123",
              "x-correlation-id": "correlation-123",
            },
          });

          expect(result.status).toBe(200);
          expect(result.body).toStrictEqual({
            requestId: "request-123",
            correlationId: "correlation-123",
            exampleId: "example-123",
          });
        });
      },
    );
  });

  describe("/example/v0/resources", () => {
    const endpoint = "/example/v0/resources";

    describe.runIf(isRouteDeployed(exampleConfig, "GET /v0/resources"))(
      "GET",
      () => {
        it("returns 200 with resolved resources", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.get(endpoint, {
            headers: authHeader,
          });

          expect(result.status).toBe(200);
          expect(result.body).toMatchObject({
            ssm: { param: expect.any(Number) as number },
            secret: { secret: expect.any(Number) as number },
            kms: { key: expect.any(Number) as number },
          });
        });
      },
    );
  });

  describe("/example/v0/resources/runtime", () => {
    const endpoint = "/example/v0/resources/runtime";

    describe.runIf(isRouteDeployed(exampleConfig, "GET /v0/resources/runtime"))(
      "GET",
      () => {
        it("returns 200 with resolved runtime resources", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.get(endpoint, {
            headers: authHeader,
          });

          expect(result.status).toBe(200);
          expect(result.body).toMatchObject({
            ssm: { param: expect.any(Number) as number },
          });
        });
      },
    );
  });

  describe("/example/v0/identity/:service", () => {
    const service = "test-service";
    const serviceId = "test-service-id";
    const endpoint = `/example/v0/identity/${service}`;

    describe.runIf(
      isRouteDeployed(exampleConfig, "GET /v0/identity/:service") &&
        udpCreateIdentityDeployed() &&
        udpDeleteIdentityDeployed(),
    )("GET", () => {
      it.todo(
        "returns 200 with linked set to true when identity exists",
        async ({ cloudfront, withIdentityLink, authHeader }) => {
          await withIdentityLink(service, serviceId);

          const result = await cloudfront.client.get(endpoint, {
            headers: authHeader,
          });

          expect(result.status).toBe(200);
          expect(result.body).toStrictEqual({ linked: true });
        },
      );

      it.todo(
        "returns 200 with linked set to false when identity does not exist",
        async ({ cloudfront, withCleanIdentity, authHeader }) => {
          await withCleanIdentity(service);

          const result = await cloudfront.client.get(endpoint, {
            headers: authHeader,
          });

          expect(result.status).toBe(200);
          expect(result.body).toStrictEqual({ linked: false });
        },
      );
    });
  });

  describe("/example/v0/notifications", () => {
    const endpoint = "/example/v0/notifications";

    describe.runIf(
      isRouteDeployed(exampleConfig, "PATCH /v0/notifications") &&
        udpGetUsersDeployed(),
    )("PATCH", () => {
      it("returns 200 with updated notifications", async ({
        cloudfront,
        udpUser: _,
        authHeader,
      }) => {
        const result = await cloudfront.client.patch(endpoint, {
          headers: authHeader,
          body: { consentStatus: "accepted" },
        });

        expect(result.status).toBe(200);
        expect(result.body).toStrictEqual({
          consentStatus: "accepted",
          pushId: expect.any(String) as string,
        });
      });
    });
  });

  describe("/example/v0/users/notifications", () => {
    const endpoint = "/example/v0/users/notifications";

    describe.runIf(
      isRouteDeployed(exampleConfig, "GET /v0/users/notifications") &&
        udpGetUsersDeployed() &&
        udpGetPushIdDeployed() &&
        unsGetNotificationsDeployed(),
    )("GET", () => {
      it("returns 200 with user notifications", async ({
        cloudfront,
        udpUser: _,
        authHeader,
      }) => {
        const result = await cloudfront.client.get(endpoint, {
          headers: authHeader,
        });

        expect(result.status).toBe(200);
        expect(NotificationsResponseSchema.safeParse(result.body).success).toBe(
          true,
        );
      });
    });

    describe.runIf(
      isRouteDeployed(exampleConfig, "PATCH /v0/users/notifications") &&
        udpGetUsersDeployed() &&
        udpGetPushIdDeployed(),
    )("PATCH", () => {
      it("returns 200 with updated notification preferences", async ({
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
          featureFlags: {
            newUserProfileEnabled: expect.any(Boolean) as boolean,
          },
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
