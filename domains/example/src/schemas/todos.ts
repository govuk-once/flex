import { IsoDateTime, NonEmptyString } from "@flex/utils";
import z from "zod";

export const TodoIdBranded = NonEmptyString.brand<"TodoId">();
export type TodoId = z.output<typeof TodoIdBranded>;

export const TodoPrioritySchema = z.enum(["low", "medium", "high"]);
export type TodoPriority = z.output<typeof TodoPrioritySchema>;

export const TodoSchema = z.object({
  id: TodoIdBranded,
  title: NonEmptyString,
  completed: z.boolean(),
  priority: TodoPrioritySchema,
  createdAt: IsoDateTime,
});
export type Todo = z.output<typeof TodoSchema>;

export const TodoMetadataSchema = z.object({
  label: NonEmptyString,
});
export type TodoMetadata = z.output<typeof TodoMetadataSchema>;

export const TodoWithMetadataSchema = TodoSchema.extend({
  meta: TodoMetadataSchema.optional(),
});
export type TodoWithMetadata = z.output<typeof TodoWithMetadataSchema>;

export const CreateTodoRequestSchema = z.object({
  title: NonEmptyString.max(200),
  completed: z.boolean().optional().default(false),
  priority: TodoPrioritySchema.optional().default("medium"),
});
export type CreateTodoRequest = z.output<typeof CreateTodoRequestSchema>;

export const CreateTodoResponseSchema = TodoSchema;
export type CreateTodoResponse = z.output<typeof CreateTodoResponseSchema>;

export const ListTodosQuerySchema = z.object({
  completed: z.coerce.boolean().optional(),
  priority: TodoPrioritySchema.optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
  page: z.coerce.number().optional().default(1),
});
export type ListTodosQuery = z.output<typeof ListTodosQuerySchema>;

export const ListTodosResponseSchema = z.object({
  todos: z.array(TodoWithMetadataSchema),
  total: z.number(),
});
export type ListTodosResponse = z.output<typeof ListTodosResponseSchema>;

export const GetTodoResponseSchema = TodoWithMetadataSchema;
export type GetTodoResponse = z.output<typeof GetTodoResponseSchema>;
