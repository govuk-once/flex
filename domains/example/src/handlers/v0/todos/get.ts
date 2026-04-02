import { store } from "@data/store";
import { route } from "@domain";
import type { ListTodosQuery, Todo } from "@schemas/todos";

export const handler = route(
  "GET /v0/todos",
  async ({ featureFlags, logger, queryParams }) => {
    const { enableTodoMetadata } = featureFlags;
    const { limit, page, completed, priority } = queryParams;

    const todos = await store.list();

    const filtered = filter(todos, { completed, priority });
    const paginated = paginate(filtered, { limit, page });

    logger.info("Retrieved todos", { total: filtered.length, page, limit });

    const data = paginated.map((todo) => ({
      ...todo,
      ...(enableTodoMetadata && {
        meta: { label: todo.priority.toUpperCase() },
      }),
    }));

    return {
      status: 200,
      data: { todos: data, total: filtered.length },
    };
  },
);

function filter(
  todos: Todo[],
  { completed, priority }: Pick<ListTodosQuery, "completed" | "priority">,
): Todo[] {
  return todos.filter(
    (todo) =>
      (completed === undefined || todo.completed === completed) &&
      (priority === undefined || todo.priority === priority),
  );
}

function paginate(
  todos: Todo[],
  { limit, page }: Pick<ListTodosQuery, "limit" | "page">,
): Todo[] {
  return todos.slice((page - 1) * limit, page * limit);
}
