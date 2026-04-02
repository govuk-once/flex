import { store } from "@data/store";
import { route } from "@domain";
import { createTodoId } from "@utils/parser";
import createHttpError from "http-errors";

export const handler = route(
  "GET /v0/todos/:id",
  async ({ auth, featureFlags, logger, pathParams }) => {
    const { id } = pathParams;
    const { enableTodoMetadata } = featureFlags;

    const todoId = createTodoId(id);

    const todo = await store.getById(todoId);

    if (!todo) {
      logger.warn("Todo does not exist", { todoId, userId: auth.pairwiseId });
      throw new createHttpError.NotFound(`Todo does not exist: ${id}`);
    }

    logger.info("Found todo", { todo, userId: auth.pairwiseId });

    return {
      status: 200,
      data: {
        ...todo,
        ...(enableTodoMetadata && {
          meta: { label: todo.priority.toUpperCase() },
        }),
      },
    };
  },
);
