import { store } from "@data/store";
import { it } from "@flex/testing";
import { todoId } from "@tests/fixtures";
import { describe, expect, vi } from "vitest";

import { handler } from "./delete";

vi.mock("@data/store");

describe("DELETE /v0/todos/:id", () => {
  const endpoint = "/todos";

  it("returns 204 when the todo is deleted", async ({ sdk }) => {
    vi.mocked(store.delete).mockResolvedValue(true);

    const result = await handler(
      sdk.event.delete(endpoint, { params: { id: todoId } }),
      sdk.context(),
    );

    expect(vi.mocked(store.delete)).toHaveBeenCalledExactlyOnceWith(todoId);
    expect(result.statusCode).toBe(204);
  });

  it("returns 404 when the todo deletion fails", async ({ sdk }) => {
    vi.mocked(store.delete).mockResolvedValue(false);

    const result = await handler(
      sdk.event.delete(endpoint, { params: { id: todoId } }),
      sdk.context(),
    );

    expect(vi.mocked(store.delete)).toHaveBeenCalledExactlyOnceWith(todoId);
    expect(result.statusCode).toBe(404);
  });
});
