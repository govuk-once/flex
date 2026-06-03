import { store } from "@data/store";
import { it } from "@flex/testing";
import type { Todo } from "@schemas/todos";
import { createTodoId } from "@utils/parser";
import { describe, expect, vi } from "vitest";

import { handler } from "./get";

vi.mock("@data/store");

describe("GET /v0/todos/:id", () => {
  const endpoint = "/todos";

  const todoId = createTodoId("test-todo-id");

  const todo: Todo = {
    id: todoId,
    title: "Todo #1",
    completed: true,
    priority: "low",
    createdAt: "2026-03-29T11:00:00.000Z",
  };

  it.beforeEach(({ env }) => {
    env.set({ enableTodoMetadata: "false" });
  });

  it("returns 200 with the existing todo", async ({ sdk }) => {
    vi.mocked(store.getById).mockResolvedValue(todo);

    const result = await handler(
      sdk.event.get(endpoint, { params: { id: todoId } }),
      sdk.context(),
    );

    expect(vi.mocked(store.getById)).toHaveBeenCalledExactlyOnceWith(todoId);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(todo);
  });

  it("returns 404 when the todo does not exist", async ({ sdk }) => {
    vi.mocked(store.getById).mockResolvedValue(null);

    const result = await handler(
      sdk.event.get(endpoint, { params: { id: "unknown" } }),
      sdk.context(),
    );

    expect(vi.mocked(store.getById)).toHaveBeenCalledExactlyOnceWith("unknown");
    expect(result.statusCode).toBe(404);
  });

  it("includes todo metadata when enableTodoMetadata is enabled", async ({
    env,
    sdk,
  }) => {
    env.set({ enableTodoMetadata: "true" });

    const todoWithMetadata = {
      ...todo,
      meta: { label: todo.priority.toUpperCase() },
    };
    vi.mocked(store.getById).mockResolvedValue(todoWithMetadata);

    const result = await handler(
      sdk.event.get(endpoint, { params: { id: todoId } }),
      sdk.context(),
    );

    expect(vi.mocked(store.getById)).toHaveBeenCalledExactlyOnceWith(todoId);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(todoWithMetadata);
  });
});
