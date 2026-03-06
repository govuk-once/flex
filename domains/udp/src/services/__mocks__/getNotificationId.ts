import { createNotificationId } from "@test/fixtures";
import { NotificationId } from "@types";
import { vi } from "vitest";

export const getNotificationId = vi.fn(
  (): NotificationId => createNotificationId(),
);
