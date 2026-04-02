import { Todo, TodoId } from "@schemas/todos";
import { createTodoId } from "@utils/parser";

export const TODOS: Todo[] = [
  {
    id: createTodoId("todo-1"),
    title: "Todo #1",
    completed: true,
    priority: "low",
    createdAt: "2026-03-29T11:00:00.000Z",
  },
  {
    id: createTodoId("todo-2"),
    title: "Todo #2",
    completed: false,
    priority: "medium",
    createdAt: "2026-03-30T11:00:00.000Z",
  },
  {
    id: createTodoId("todo-3"),
    title: "Todo #3",
    completed: false,
    priority: "high",
    createdAt: "2026-03-31T11:00:00.000Z",
  },
];

const todos = new Map<string, Todo>(TODOS.map((t) => [t.id, t]));

export const store = {
  create: async (data: Todo): Promise<Todo> => {
    todos.set(data.id, data);
    return Promise.resolve(data);
  },
  list: (): Promise<Todo[]> => Promise.resolve([...todos.values()]),
  getById: (id: TodoId): Promise<Todo | null> =>
    Promise.resolve(todos.get(id) ?? null),
  update: (data: Todo): Promise<Todo | null> => {
    if (!todos.has(data.id)) return Promise.resolve(null);
    todos.set(data.id, data);
    return Promise.resolve(data);
  },
  delete: (id: TodoId) => Promise.resolve(todos.delete(id)),
};
