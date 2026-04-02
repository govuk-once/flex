import { store } from "@data/store";
import { route } from "@domain";
import { createTodoId } from "@utils/parser";
import createHttpError from "http-errors";

export const handler = route(
  "POST /v0/todos/:id/duplicate",
  async ({ auth, integrations, logger, pathParams }) => {
    const { id } = pathParams;

    const todoId = createTodoId(id);

    const todo = await store.getById(todoId);

    if (!todo) {
      logger.warn("Todo not found", { todoId, userId: auth.pairwiseId });
      throw new createHttpError.NotFound(`Todo not found: ${id}`);
    }

    logger.info("Found todo", { todo, userId: auth.pairwiseId });

    const result = await integrations.createTodo({
      body: {
        title: `${todo.title} (copy)`,
        completed: false,
        priority: todo.priority,
      },
    });

    if (!result.ok) {
      logger.error("Failed to duplicate todo", {
        todoId,
        userId: auth.pairwiseId,
        error: result.error,
      });
      throw new createHttpError.BadGateway();
    }

    logger.info("Todo duplicated", {
      originalTodoId: todoId,
      duplicateTodoId: result.data.id,
    });

    return { status: 201, data: result.data };
  },
);
