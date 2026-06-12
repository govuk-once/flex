import "./http";

import { beforeEach, vi } from "vitest";

vi.mock("@flex/flex-fetch");

vi.mock("@middy/secrets-manager", () => ({
  default: () => ({ before: vi.fn() }),
  secretsManagerParam: vi.fn((v: string) => v),
}));

vi.mock("@middy/ssm", () => ({
  default: () => ({ before: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
