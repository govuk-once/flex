import { store } from "@data/store";
import { it } from "@flex/testing";
import { createTodoId } from "@utils/parser";
import { describe, expect, vi } from "vitest";

import { handler } from "./delete";

vi.mock("@data/store");

describe("DELETE /v0/todos/:id", () => {
  const endpoint = "/todos";
  const todoId = createTodoId("todo-uuid");
  const event = {
    httpMethod: "DELETE",
    path: endpoint,
    pathParameters: { id: todoId },
  };

  describe("response", () => {
    it("returns 204 when todo is deleted", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      vi.mocked(store.delete).mockResolvedValue(true);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(vi.mocked(store.delete)).toHaveBeenCalledExactlyOnceWith(todoId);

      expect(result.statusCode).toBe(204);
    });
  });

  describe("errors", () => {
    it("returns 404 when todo deletion fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      vi.mocked(store.delete).mockResolvedValue(false);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(vi.mocked(store.delete)).toHaveBeenCalledExactlyOnceWith(todoId);

      expect(result.statusCode).toBe(404);
    });
  });
});
