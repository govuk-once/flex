import { vi } from "vitest";

vi.mock("@flex/flex-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@flex/flex-fetch")>()),
  createSigv4Fetcher:
    ({ baseUrl }: { baseUrl: string }) =>
    (path: string, options?: RequestInit) => ({
      request: fetch(`${baseUrl}${path}`, options),
      abort: vi.fn(),
    }),
}));
