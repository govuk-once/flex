import type { NotificationId } from "@schemas/notifications";

export const createNotificationId = (id = "test-notification-id") =>
  id as NotificationId;

export const notificationId = createNotificationId();
