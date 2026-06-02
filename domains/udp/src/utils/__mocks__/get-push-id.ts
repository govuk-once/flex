import { pushId } from "@tests/fixtures";
import { vi } from "vitest";

export const getPushId = vi.fn(() => pushId);
