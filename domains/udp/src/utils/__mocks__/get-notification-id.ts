import type { NotificationId } from "@schemas/notifications";
import { vi } from "vitest";

export const getNotificationId = vi.fn(
  () => "test-notification-id" as NotificationId,
);
