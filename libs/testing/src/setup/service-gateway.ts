import { beforeEach, vi } from "vitest";

vi.mock("@aws-lambda-powertools/parameters/secrets", () => ({
  getSecret: vi.fn(),
}));

const mockFetcher = vi.hoisted(() => vi.fn());
vi.mock("@flex/sdk", () => ({
  createSigv4FetchWithCredentials: vi.fn(() => mockFetcher),
  typedFetch: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
