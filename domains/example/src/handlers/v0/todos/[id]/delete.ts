import { store } from "@data/store";
import { route } from "@domain";
import { createTodoId } from "@utils/parser";
import createHttpError from "http-errors";

export const handler = route(
  "DELETE /v0/todos/:id",
  async ({ auth, logger, pathParams }) => {
    const { id } = pathParams;

    const todoId = createTodoId(id);

    const deleted = await store.delete(todoId);

    if (!deleted) {
      logger.warn("Failed to delete todo", { todoId, userId: auth.pairwiseId });
      throw new createHttpError.NotFound(`Failed to delete todo: ${id}`);
    }

    logger.info("Todo deleted", { todoId, userId: auth.pairwiseId });

    return { status: 204 };
  },
);
