import { beforeEach, vi } from "vitest";

vi.mock("@aws-lambda-powertools/parameters/secrets", () => ({
  getSecret: vi.fn(),
}));

const mockFetcher = vi.hoisted(() => vi.fn());

vi.mock("@flex/flex-fetch", () => ({
  createSigv4FetchWithCredentials: vi.fn(() => mockFetcher),
  typedFetch: vi.fn(),
}));
vi.mock("@flex/logging", () => ({
  injectLambdaContext: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    setServiceName: vi.fn(),
    setLogLevel: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});
