import type { PushId } from "@schemas/notifications";
import { vi } from "vitest";

export const getPushId = vi.fn(() => "test-notification-id" as PushId);
