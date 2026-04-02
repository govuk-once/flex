import { store, TODOS } from "@data/store";
import { it } from "@flex/testing";
import type { APIGatewayProxyEventQueryStringParameters } from "aws-lambda";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./get";

vi.mock("@data/store");

describe("GET /v0/todos", () => {
  const endpoint = "/todos";
  const event = { httpMethod: "GET", path: endpoint };

  beforeEach(() => {
    vi.stubEnv("enableTodoMetadata", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("request validation", () => {
    it.for<{
      queryStringParameters: APIGatewayProxyEventQueryStringParameters;
      reason: string;
      expected: { field: string };
    }>([
      {
        queryStringParameters: { priority: "unknown" },
        reason: "contains invalid priority",
        expected: { field: "priority" },
      },
      {
        queryStringParameters: { limit: "0" },
        reason: "contains limit below minimum",
        expected: { field: "limit" },
      },
      {
        queryStringParameters: { limit: "101" },
        reason: "contains limit above maximum",
        expected: { field: "limit" },
      },
    ])(
      "returns 400 when query $reason",
      async (
        { queryStringParameters, expected },
        { context, privateGatewayEventWithAuthorizer },
      ) => {
        const result = await handler(
          privateGatewayEventWithAuthorizer.create({
            ...event,
            queryStringParameters,
          }),
          context.create(),
        );

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toStrictEqual({
          message: "Invalid query parameters",
          errors: [
            { field: expected.field, message: expect.any(String) as string },
          ],
        });
      },
    );
  });

  describe("response", () => {
    it("returns 200 with all todos", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      vi.mocked(store.list).mockResolvedValue(TODOS);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual({ todos: TODOS, total: 3 });
    });

    it("returns 200 with todos filtered by completed status", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      vi.mocked(store.list).mockResolvedValue(TODOS);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          ...event,
          queryStringParameters: { completed: "true" },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual({
        todos: [TODOS[0]],
        total: 1,
      });
    });

    it("returns 200 with todos filtered by priority", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      vi.mocked(store.list).mockResolvedValue(TODOS);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          ...event,
          queryStringParameters: { priority: "low" },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual({
        todos: [TODOS[0]],
        total: 1,
      });
    });

    it("returns 200 with paginated results", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      vi.mocked(store.list).mockResolvedValue(TODOS);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          ...event,
          queryStringParameters: { limit: "1", page: "2" },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual({
        todos: [TODOS[1]],
        total: 3,
      });
    });

    it("returns 200 with no results", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      vi.mocked(store.list).mockResolvedValue(TODOS);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          ...event,
          queryStringParameters: { completed: "true", priority: "high" },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual({ todos: [], total: 0 });
    });
  });

  describe("feature flags", () => {
    describe("enableTodoMetadata", () => {
      const todosWithMetadata = TODOS.map((t) => ({
        ...t,
        meta: { label: t.priority.toUpperCase() },
      }));

      beforeEach(() => {
        vi.stubEnv("enableTodoMetadata", "true");
      });

      it("includes todo metadata when enabled", async ({
        context,
        privateGatewayEventWithAuthorizer,
      }) => {
        vi.mocked(store.list).mockResolvedValue(TODOS);

        const result = await handler(
          privateGatewayEventWithAuthorizer.create(event),
          context.create(),
        );

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toStrictEqual({
          todos: todosWithMetadata,
          total: 3,
        });
      });
    });
  });
});
