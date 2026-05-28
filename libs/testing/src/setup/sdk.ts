import "./http";

import { beforeEach, vi } from "vitest";

vi.mock("@flex/flex-fetch", async (importOriginal) => ({
  ...(await importOriginal()),
  createSigv4Fetcher:
    ({ baseUrl }: { baseUrl: string }) =>
    (path: string, options?: RequestInit) => ({
      request: fetch(`${baseUrl}${path}`, options),
      abort: vi.fn(),
    }),
}));

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
