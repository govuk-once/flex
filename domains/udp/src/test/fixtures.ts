import { NotificationId } from "@types";

/** Creates a branded NotificationId for tests. Uses schema parse so invalid strings fail. */
export const createNotificationId = (id = "test-notification-id") =>
  id as NotificationId;

/** Shared default for tests that need a NotificationId. */
export const testNotificationId = createNotificationId();
