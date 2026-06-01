import { store } from "@data/store";
import { it } from "@flex/testing";
import type { Todo } from "@schemas/todos";
import { createTodoId } from "@utils/parser";
import { afterAll, beforeAll, describe, expect, vi } from "vitest";

import { handler } from "./post.private";

vi.mock("node:crypto", () => ({
  default: { randomUUID: vi.fn().mockReturnValue("test-todo-id") },
}));
vi.mock("@data/store");

describe("POST /v0/todos [private]", () => {
  const endpoint = "/todos";

  const todoId = createTodoId("test-todo-id");

  const todo: Todo = {
    id: todoId,
    title: "My todo",
    completed: false,
    priority: "medium",
    createdAt: "2026-04-01T12:00:00.000Z",
  };

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it.for([
    { body: {}, reason: "is empty" },
    { body: { title: "" }, reason: "contains empty title" },
    {
      body: { title: "Title", priority: "unknown" },
      reason: "contains invalid priority",
    },
  ])("returns 400 when payload $reason", async ({ body }, { sdk }) => {
    const result = await handler(
      sdk.event.post(endpoint, { body }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toStrictEqual({
      message: "Invalid request body",
    });
  });

  it("returns 200 with created todo", async ({ sdk }) => {
    const result = await handler(
      sdk.event.post(endpoint, { body: { title: "My todo" } }),
      sdk.context(),
    );

    expect(vi.mocked(store.create)).toHaveBeenCalledExactlyOnceWith(todo);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(todo);
  });

  it("returns 200 with created todo when full payload is provided", async ({
    sdk,
  }) => {
    const payload: Pick<Todo, "title" | "completed" | "priority"> = {
      title: "My todo",
      completed: true,
      priority: "high",
    };

    const expected: Todo = {
      ...payload,
      id: todoId,
      createdAt: "2026-04-01T12:00:00.000Z",
    };

    const result = await handler(
      sdk.event.post(endpoint, { body: payload }),
      sdk.context(),
    );

    expect(vi.mocked(store.create)).toHaveBeenCalledExactlyOnceWith(expected);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(expected);
  });
});
