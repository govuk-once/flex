import { store } from "@data/store";
import { it } from "@flex/testing";
import type { Todo } from "@schemas/todos";
import { createTodoId } from "@utils/parser";
import nock from "nock";
import { describe, expect, vi } from "vitest";

import { handler } from "./post";

vi.mock("@data/store");

describe("POST /v0/todos/:id/duplicate", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const endpoint = "/todos";

  const todoId = createTodoId("todo-uuid");
  const event = {
    httpMethod: "POST",
    path: endpoint,
    pathParameters: { id: todoId },
  };
  const todo: Todo = {
    id: todoId,
    title: "Todo #1",
    completed: true,
    priority: "low",
    createdAt: "2026-03-29T11:00:00.000Z",
  };
  const duplicatedTodo: Todo = {
    id: todoId,
    title: "Todo #1 (copy)",
    completed: false,
    priority: "low",
    createdAt: "2026-04-01T12:00:00.000Z",
  };

  describe("response", () => {
    it("returns 201 with the duplicated todo", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      vi.mocked(store.getById).mockResolvedValue(todo);

      api
        .post("/domains/example/v0/todos", {
          title: "Todo #1 (copy)",
          completed: false,
          priority: "low",
        })
        .reply(200, duplicatedTodo);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(vi.mocked(store.getById)).toHaveBeenCalledExactlyOnceWith(todoId);

      expect(result.statusCode).toBe(201);
      expect(JSON.parse(result.body)).toStrictEqual(duplicatedTodo);
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

    it("returns 502 when integration fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      vi.mocked(store.getById).mockResolvedValue(todo);

      api.post("/domains/example/v0/todos").reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(vi.mocked(store.getById)).toHaveBeenCalledExactlyOnceWith(todoId);

      expect(result.statusCode).toBe(502);
    });
  });
});
