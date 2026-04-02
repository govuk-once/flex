import { store } from "@data/store";
import { it } from "@flex/testing";
import type { Todo } from "@schemas/todos";
import { createTodoId } from "@utils/parser";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./get";

vi.mock("@data/store");

describe("GET /v0/todos/:id", () => {
  const endpoint = "/todos";
  const todoId = createTodoId("todo-uuid");
  const event = {
    httpMethod: "GET",
    path: endpoint,
    pathParameters: { id: todoId },
  };
  const existingTodo: Todo = {
    id: todoId,
    title: "Todo #1",
    completed: true,
    priority: "low",
    createdAt: "2026-03-29T11:00:00.000Z",
  };

  beforeEach(() => {
    vi.stubEnv("enableTodoMetadata", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("response", () => {
    it("returns 200 with existing todo", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      vi.mocked(store.getById).mockResolvedValue(existingTodo);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(vi.mocked(store.getById)).toHaveBeenCalledExactlyOnceWith(todoId);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual(existingTodo);
    });
  });

  describe("errors", () => {
    it("returns 404 when todo does not exist", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      vi.mocked(store.getById).mockResolvedValue(null);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          ...event,
          pathParameters: { id: "unknown" },
        }),
        context.create(),
      );

      expect(vi.mocked(store.getById)).toHaveBeenCalledExactlyOnceWith(
        "unknown",
      );

      expect(result.statusCode).toBe(404);
    });
  });

  describe("feature flags", () => {
    describe("enableTodoMetadata", () => {
      const todoWithMetadata = {
        ...existingTodo,
        meta: { label: existingTodo.priority.toUpperCase() },
      };

      beforeEach(() => {
        vi.stubEnv("enableTodoMetadata", "true");
      });

      it("includes todo metadata when enabled", async ({
        context,
        privateGatewayEventWithAuthorizer,
      }) => {
        vi.mocked(store.getById).mockResolvedValue(todoWithMetadata);

        const result = await handler(
          privateGatewayEventWithAuthorizer.create(event),
          context.create(),
        );

        expect(vi.mocked(store.getById)).toHaveBeenCalledExactlyOnceWith(
          todoId,
        );

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toStrictEqual(todoWithMetadata);
      });
    });
  });
});
