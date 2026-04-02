import { store } from "@data/store";
import { it } from "@flex/testing";
import { Todo } from "@schemas/todos";
import { createTodoId } from "@utils/parser";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  vi,
} from "vitest";

import { handler } from "./post.private";

vi.mock("node:crypto", () => ({
  default: { randomUUID: vi.fn().mockReturnValue("test-uuid") },
}));
vi.mock("@data/store");

describe("POST /v0/todos [private]", () => {
  const endpoint = "/todos";
  const todoId = createTodoId("test-uuid");
  const createdTodo: Todo = {
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

  beforeEach(() => {
    vi.stubEnv("enableTodoMetadata", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("request validation", () => {
    it.for([
      { body: {}, reason: "is empty" },
      { body: { title: "" }, reason: "contains empty title" },
      {
        body: { title: "Title", priority: "unknown" },
        reason: "contains invalid priority",
      },
    ])(
      "returns 400 when payload $reason",
      async ({ body }, { context, privateGatewayEventWithAuthorizer }) => {
        const result = await handler(
          privateGatewayEventWithAuthorizer.post(endpoint, { body }),
          context.create(),
        );

        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toStrictEqual({
          message: "Invalid request body",
        });
      },
    );
  });

  describe("response", () => {
    it("returns 200 with created todo", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const result = await handler(
        privateGatewayEventWithAuthorizer.post(endpoint, {
          body: { title: "My todo" },
        }),
        context.create(),
      );

      expect(vi.mocked(store.create)).toHaveBeenCalledExactlyOnceWith(
        createdTodo,
      );

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual(createdTodo);
    });

    it("returns 200 with created todo when full payload is provided", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const payload: Pick<Todo, "title" | "completed" | "priority"> = {
        title: "My todo",
        completed: true,
        priority: "high",
      };

      const expectedTodo: Todo = {
        ...payload,
        id: createTodoId("test-uuid"),
        createdAt: "2026-04-01T12:00:00.000Z",
      };

      const result = await handler(
        privateGatewayEventWithAuthorizer.post(endpoint, { body: payload }),
        context.create(),
      );

      expect(vi.mocked(store.create)).toHaveBeenCalledExactlyOnceWith(
        expectedTodo,
      );

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual(expectedTodo);
    });
  });
});
