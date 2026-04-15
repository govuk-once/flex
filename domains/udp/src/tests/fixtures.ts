import type { PushId } from "@schemas/notifications";

export const createPushId = (id = "test-notification-id") => id as PushId;

export const pushId = createPushId();
