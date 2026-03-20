import { it } from "@flex/testing/e2e";
import type {
  GetUserResponse,
  UpdateNotificationPreferencesOutboundResponse,
  UpdateNotificationPreferencesRequest,
} from "@flex/udp-domain";
import { describe, expect, inject } from "vitest";

describe("UDP domain", () => {
  const { JWT } = inject("e2eEnv");

  const authorization = { Authorization: `Bearer ${JWT.VALID}` };

  describe("/udp/v1/identity/:service", () => {
    const service = "test-service";
    const endpoint = `/udp/v1/identity/${service}`;

    describe("GET", () => {
      it("rejects unauthenticated requests", async ({ cloudfront }) => {
        const result = await cloudfront.client.get(endpoint);

        expect(result.status).toBe(401);
        expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
      });

      it("returns 200 with service identity link status", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.get(endpoint, {
          headers: { ...authorization },
        });

        expect(result.status).toBe(200);
        expect(result.body).toStrictEqual({
          linked: expect.any(Boolean) as boolean,
        });
      });
    });

    describe("DELETE", () => {
      it("rejects unauthenticated requests", async ({ cloudfront }) => {
        const result = await cloudfront.client.delete(endpoint);

        expect(result.status).toBe(401);
        expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
      });

      it("returns 204 when identity is unlinked successfully", async ({
        cloudfront,
      }) => {
        const created = await cloudfront.client.post(
          `${endpoint}/test-service-id`,
          { headers: { ...authorization } },
        );

        expect(created.status).toBe(201);

        const result = await cloudfront.client.delete(endpoint, {
          headers: { ...authorization },
        });

        expect(result.status).toBe(204);
      });
    });
  });

  describe("/udp/v1/identity/:service/:id", () => {
    const service = "test-service";
    const serviceId = "test-service-id";
    const endpoint = `/udp/v1/identity/${service}/${serviceId}`;

    describe("POST", () => {
      it("rejects unauthenticated requests", async ({ cloudfront }) => {
        const result = await cloudfront.client.post(endpoint);

        expect(result.status).toBe(401);
        expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
      });

      it("returns 201 when identity is linked successfully", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.post(endpoint, {
          headers: { ...authorization },
        });

        expect(result.status).toBe(201);
      });
    });
  });

  describe("/udp/v1/users", () => {
    const endpoint = "/udp/v1/users";

    describe("GET", () => {
      it("rejects unauthenticated requests", async ({ cloudfront }) => {
        const result = await cloudfront.client.get(endpoint);

        expect(result.status).toBe(401);
        expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
      });

      it("returns 200 with user profile", async ({ cloudfront }) => {
        const result = await cloudfront.client.get<GetUserResponse>(endpoint, {
          headers: { ...authorization },
        });

        expect(result.status).toBe(200);
        expect(result.body).toStrictEqual({
          userId: expect.any(String) as string,
          notificationId: expect.any(String) as string,
          notifications: {
            consentStatus: expect.any(String) as string,
            notificationId: expect.any(String) as string,
          },
        });
      });
    });
  });

  describe("/udp/v1/users/notifications", () => {
    const endpoint = "/udp/v1/users/notifications";

    describe("PATCH", () => {
      it("rejects unauthenticated requests", async ({ cloudfront }) => {
        const result = await cloudfront.client.patch(endpoint);

        expect(result.status).toBe(401);
        expect(result.headers.get("x-rejected-by")).toBe("cloudfront-function");
      });

      it("returns 200 with updated user notification preferences", async ({
        cloudfront,
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
          notificationId: expect.any(String) as string,
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
