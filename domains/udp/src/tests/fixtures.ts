import { createUserId } from "@flex/testing";
import type { PushId } from "@schemas/notifications";

export { createUserId };
export const createPushId = (id = "test-push-id") => id as PushId;

export const userId = createUserId();
export const pushId = createPushId();
