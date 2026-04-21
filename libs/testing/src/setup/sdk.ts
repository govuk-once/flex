import nock from "nock";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";

vi.mock("@flex/flex-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@flex/flex-fetch")>()),
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

beforeAll(() => {
  nock.disableNetConnect();
});

afterAll(() => {
  nock.enableNetConnect();
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // Useful to see which request(s) failed/were not intercepted
  expect(nock.pendingMocks()).toStrictEqual([]);
  nock.cleanAll();
});
