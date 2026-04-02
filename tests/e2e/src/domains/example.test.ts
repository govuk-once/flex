import { describe, expect, inject } from "vitest";

import { it } from "../extend/it";

describe("Example domain", () => {
  const { JWT } = inject("e2eEnv");

  const authorization = { Authorization: `Bearer ${JWT.VALID}` };

  describe("/example/v0/todos", () => {
    const endpoint = "/example/v0/todos";

    describe("GET", () => {
      it("returns 200 with list of todos", async ({ cloudfront }) => {
        const result = await cloudfront.client.get(endpoint, {
          headers: { ...authorization },
        });

        expect(result.status).toBe(200);
        expect(result.body).toStrictEqual({
          todos: expect.any(Array) as unknown[],
          total: expect.any(Number) as number,
        });
      });

      it("returns 200 with filtered results", async ({ cloudfront }) => {
        const result = await cloudfront.client.get(
          `${endpoint}?priority=low&limit=1`,
          { headers: { ...authorization } },
        );

        expect(result.status).toBe(200);
        expect(result.body).toMatchObject({
          todos: expect.any(Array) as unknown[],
          total: expect.any(Number) as number,
        });
      });
    });
  });

  describe("/example/v0/todos/:id", () => {
    const endpoint = "/example/v0/todos";
    const todoId = "todo-1";

    describe("GET", () => {
      it("returns 200 with existing todo", async ({ cloudfront }) => {
        const result = await cloudfront.client.get(`${endpoint}/${todoId}`, {
          headers: { ...authorization },
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
    });
  });

  describe("/example/v0/todos/:id/duplicate", () => {
    describe("POST", () => {
      it("returns 201 with duplicated todo", async ({ cloudfront }) => {
        const result = await cloudfront.client.post(
          "/example/v0/todos/todo-1/duplicate",
          { headers: { ...authorization } },
        );

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

    describe("GET", () => {
      it("returns 200 with resolved headers", async ({ cloudfront }) => {
        const result = await cloudfront.client.get(endpoint, {
          headers: {
            ...authorization,
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
    });
  });

  describe("/example/v0/resources", () => {
    const endpoint = "/example/v0/resources";

    describe("GET", () => {
      it("returns 200 with resolved resources", async ({ cloudfront }) => {
        const result = await cloudfront.client.get(endpoint, {
          headers: { ...authorization },
        });

        expect(result.status).toBe(200);
        expect(result.body).toMatchObject({
          ssm: { param: expect.any(Number) as number },
          secret: { secret: expect.any(Number) as number },
          kms: { key: expect.any(Number) as number },
        });
      });
    });
  });

  describe("/example/v0/resources/runtime", () => {
    const endpoint = "/example/v0/resources/runtime";

    describe("GET", () => {
      it("returns 200 with resolved runtime resources", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.get(endpoint, {
          headers: { ...authorization },
        });

        expect(result.status).toBe(200);
        expect(result.body).toMatchObject({
          ssm: { param: expect.any(Number) as number },
        });
      });
    });
  });

  describe("/example/v0/identity/:service", () => {
    const service = "test-service";
    const serviceId = "test-service-id";
    const endpoint = `/example/v0/identity/${service}`;

    describe("GET", () => {
      it.todo(
        "returns 200 with linked set to true when identity exists",
        async ({ cloudfront, withIdentityLink }) => {
          await withIdentityLink(service, serviceId);

          const result = await cloudfront.client.get(endpoint, {
            headers: { ...authorization },
          });

          expect(result.status).toBe(200);
          expect(result.body).toStrictEqual({ linked: true });
        },
      );

      it.todo(
        "returns 200 with linked set to false when identity does not exist",
        async ({ cloudfront, withCleanIdentity }) => {
          await withCleanIdentity(service);

          const result = await cloudfront.client.get(endpoint, {
            headers: { ...authorization },
          });

          expect(result.status).toBe(200);
          expect(result.body).toStrictEqual({ linked: false });
        },
      );
    });
  });

  describe("/example/v0/notifications", () => {
    const endpoint = "/example/v0/notifications";

    describe("PATCH", () => {
      it("returns 200 with updated notifications", async ({
        cloudfront,
        udpUser: _,
      }) => {
        const result = await cloudfront.client.patch(endpoint, {
          headers: { ...authorization },
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
});
