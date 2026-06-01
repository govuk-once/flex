import { store } from "@data/store";
import { it } from "@flex/testing";
import type { Todo } from "@schemas/todos";
import { createTodoId } from "@utils/parser";
import { describe, expect, vi } from "vitest";

import { handler } from "./post";

vi.mock("@data/store");

describe("POST /v0/todos/:id/duplicate", () => {
  const endpoint = "/todos";

  const todoId = createTodoId("todo-uuid");

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

  it("returns 201 with the duplicated todo", async ({ http, sdk }) => {
    vi.mocked(store.getById).mockResolvedValue(todo);

    http
      .domain("example", "v0")
      .post("/todos", {
        body: { title: "Todo #1 (copy)", completed: false, priority: "low" },
      })
      .reply(200, duplicatedTodo);

    const result = await handler(
      sdk.event.post(endpoint, { params: { id: todoId } }),
      sdk.context(),
    );

    expect(vi.mocked(store.getById)).toHaveBeenCalledExactlyOnceWith(todoId);
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toStrictEqual(duplicatedTodo);
  });

  it("returns 404 when the todo does not exist", async ({ sdk }) => {
    vi.mocked(store.getById).mockResolvedValue(null);

    const result = await handler(
      sdk.event.post(endpoint, { params: { id: "unknown" } }),
      sdk.context(),
    );

    expect(vi.mocked(store.getById)).toHaveBeenCalledExactlyOnceWith("unknown");
    expect(result.statusCode).toBe(404);
  });

  it("returns 502 when the integration fails", async ({ http, sdk }) => {
    vi.mocked(store.getById).mockResolvedValue(todo);

    http.domain("example", "v0").post("/todos").reply(500);

    const result = await handler(
      sdk.event.post(endpoint, { params: { id: todoId } }),
      sdk.context(),
    );

    expect(vi.mocked(store.getById)).toHaveBeenCalledExactlyOnceWith(todoId);
    expect(result.statusCode).toBe(502);
  });
});
