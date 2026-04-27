import type { Mock } from "vitest";
import { vi } from "vitest";

import type { store as originalStore } from "../store";

export { TODOS } from "../store";

export const store: Record<keyof typeof originalStore, Mock> = {
  create: vi.fn(),
  list: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};
