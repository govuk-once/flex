import { PushIdBranded } from "@flex/udp-domain";
import { UserId } from "@flex/utils";
import { TodoIdBranded } from "@schemas/todos";

export const createTodoId = (value: string) => TodoIdBranded.parse(value);
export const createPushId = (value: string) => PushIdBranded.parse(value);
export const createUserId = (value: string) => UserId.parse(value);
