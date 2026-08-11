import "./http";

import { clearCaches } from "@aws-lambda-powertools/parameters";
import { beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.clearAllMocks();
  clearCaches();
});

vi.mock("@flex/sdk", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createSigv4FetchWithCredentials:
    ({ baseUrl }: { baseUrl: string }) =>
    (path: string, options?: RequestInit) => ({
      request: fetch(`${baseUrl}${path}`, options),
      abort: vi.fn(),
    }),
}));
