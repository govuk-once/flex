import { createUserId, mergeFixture } from "@flex/testing";
import type { PushId } from "@flex/udp-domain";
import type { Todo, TodoId, TodoWithMetadata } from "@schemas/todos";

export { createUserId };
export const userId = createUserId();

export const createTimestamp = (value = "2026-04-01T12:00:00.000Z") => value;
export const timestamp = createTimestamp();

export const createPushId = (value = "test-push-id") => value as PushId;
export const pushId = createPushId();

export const createSecrets = (overrides?: Record<string, unknown>) =>
  mergeFixture(
    { udpNotificationSecret: "test-notification-secret" }, // pragma: allowlist secret
    overrides,
  );
export const secrets = createSecrets();

export const createParams = (overrides?: Record<string, unknown>) =>
  mergeFixture({ privateGatewaysRoot: "test-param-value" }, overrides);
export const params = createParams();

export const createServiceId = (value = "test-service-id") => value;
export const serviceId = createServiceId();

export const createServiceName = (value = "test-service-name") => value;
export const serviceName = createServiceName();

export const createServiceIdentityLink = (
  overrides?: Partial<{ serviceId: string; serviceName: string }>,
) => mergeFixture({ serviceId, serviceName }, overrides);
export const serviceIdentityLink = createServiceIdentityLink();

export const createTodoId = (value = "test-todo-id") => value as TodoId;
export const todoId = createTodoId();

export const createTodo = (overrides?: Partial<Todo>) =>
  mergeFixture<Todo>(
    {
      id: todoId,
      title: "Todo #1",
      completed: true,
      priority: "low",
      createdAt: timestamp,
    },
    overrides,
  );
export const todo = createTodo();

export const withMetadata = (value: Todo): TodoWithMetadata => ({
  ...value,
  meta: { label: value.priority.toUpperCase() },
});

export const createTodoWithMetadata = (overrides?: Partial<Todo>) =>
  withMetadata(createTodo(overrides));
export const todoWithMetadata = createTodoWithMetadata();
