import { beforeEach, vi } from "vitest";

const mockFetcher = vi.hoisted(() => vi.fn());

vi.mock("@flex/flex-fetch", () => ({
  createSigv4FetchWithCredentials: vi.fn(() => mockFetcher),
  typedFetch: vi.fn(),
}));

vi.mock("@aws-lambda-powertools/parameters/secrets", () => ({
  getSecret: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
