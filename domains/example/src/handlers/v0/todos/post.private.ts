import crypto from "node:crypto";

import { store } from "@data/store";
import { route } from "@domain";
import { createTodoId } from "@utils/parser";

export const handler = route(
  "POST /v0/todos [private]",
  async ({ body, logger }) => {
    const todoId = createTodoId(crypto.randomUUID());

    const todo = { ...body, id: todoId, createdAt: new Date().toISOString() };

    await store.create(todo);

    logger.info("Todo created", { todoId });

    return { status: 200, data: todo };
  },
);
