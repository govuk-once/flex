import { store } from "@data/store";
import { it, timestamp } from "@flex/testing";
import type { Todo } from "@schemas/todos";
import { createTodo, todoId } from "@tests/fixtures";
import { afterAll, beforeAll, describe, expect, vi } from "vitest";

import { handler } from "./post.private";

vi.mock("node:crypto", () => ({
  default: { randomUUID: vi.fn().mockReturnValue(todoId) },
}));
vi.mock("@data/store");

describe("POST /v0/todos [private]", () => {
  const endpoint = "/todos";

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(timestamp));
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
    const payload = { title: "My todo" };

    const newTodo = createTodo({
      ...payload,
      completed: false,
      priority: "medium",
    });

    const result = await handler(
      sdk.event.post(endpoint, { body: payload }),
      sdk.context(),
    );

    expect(vi.mocked(store.create)).toHaveBeenCalledExactlyOnceWith(newTodo);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(newTodo);
  });

  it("returns 200 with created todo when full payload is provided", async ({
    sdk,
  }) => {
    const payload = {
      title: "My todo",
      completed: true,
      priority: "high",
    } satisfies Partial<Todo>;

    const expected = createTodo(payload);

    const result = await handler(
      sdk.event.post(endpoint, { body: payload }),
      sdk.context(),
    );

    expect(vi.mocked(store.create)).toHaveBeenCalledExactlyOnceWith(expected);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(expected);
  });
});
