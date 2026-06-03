import { store, TODOS } from "@data/store";
import { it } from "@flex/testing";
import { describe, expect, vi } from "vitest";

import { handler } from "./get";

vi.mock("@data/store");

describe("GET /v0/todos", () => {
  const endpoint = "/todos";

  it.beforeEach(({ env }) => {
    env.set({ enableTodoMetadata: "false" });
  });

  it.for<{
    query: Record<string, string>;
    reason: string;
    field: string;
  }>([
    {
      query: { priority: "unknown" },
      reason: "contains invalid priority",
      field: "priority",
    },
    {
      query: { limit: "0" },
      reason: "contains limit below minimum",
      field: "limit",
    },
    {
      query: { limit: "101" },
      reason: "contains limit above maximum",
      field: "limit",
    },
  ])("returns 400 when query $reason", async ({ query, field }, { sdk }) => {
    const result = await handler(
      sdk.event.get(endpoint, { query }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toStrictEqual({
      message: "Invalid query parameters",
      errors: [{ field, message: expect.any(String) as string }],
    });
  });

  it("returns 200 with all todos", async ({ sdk }) => {
    vi.mocked(store.list).mockResolvedValue(TODOS);

    const result = await handler(sdk.event.get(endpoint), sdk.context());

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({ todos: TODOS, total: 3 });
  });

  it("returns 200 with todos filtered by completed status", async ({ sdk }) => {
    vi.mocked(store.list).mockResolvedValue(TODOS);

    const result = await handler(
      sdk.event.get(endpoint, { query: { completed: "true" } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({
      todos: [TODOS[0]],
      total: 1,
    });
  });

  it("returns 200 with todos filtered by priority", async ({ sdk }) => {
    vi.mocked(store.list).mockResolvedValue(TODOS);

    const result = await handler(
      sdk.event.get(endpoint, { query: { priority: "low" } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({
      todos: [TODOS[0]],
      total: 1,
    });
  });

  it("returns 200 with paginated results", async ({ sdk }) => {
    vi.mocked(store.list).mockResolvedValue(TODOS);

    const result = await handler(
      sdk.event.get(endpoint, { query: { limit: "1", page: "2" } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({
      todos: [TODOS[1]],
      total: 3,
    });
  });

  it("returns 200 with no results", async ({ sdk }) => {
    vi.mocked(store.list).mockResolvedValue(TODOS);

    const result = await handler(
      sdk.event.get(endpoint, {
        query: { completed: "true", priority: "high" },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({ todos: [], total: 0 });
  });

  it("includes todo metadata when enableTodoMetadata is enabled", async ({
    env,
    sdk,
  }) => {
    env.set({ enableTodoMetadata: "true" });

    const todosWithMetadata = TODOS.map((t) => ({
      ...t,
      meta: { label: t.priority.toUpperCase() },
    }));

    vi.mocked(store.list).mockResolvedValue(TODOS);

    const result = await handler(sdk.event.get(endpoint), sdk.context());

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({
      todos: todosWithMetadata,
      total: 3,
    });
  });
});
