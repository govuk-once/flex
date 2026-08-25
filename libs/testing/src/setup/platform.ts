import "./http";

import { clearCaches } from "@aws-lambda-powertools/parameters";
import { afterAll, beforeEach, vi } from "vitest";

import { resetClientMocks, restoreClientMocks } from "../utils/awsMock";

beforeEach(() => {
  vi.clearAllMocks();
  clearCaches();
  // Every AWS client mock a fixture installed starts the test with no stubs
  // and no recorded calls, so nothing leaks between tests.
  resetClientMocks();
});

afterAll(() => {
  restoreClientMocks();
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
