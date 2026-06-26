import "./http";

import { beforeEach, vi } from "vitest";

vi.mock("@flex/sdk", async () => ({
  ...(await vi.importActual("@flex/sdk")),
  createSigv4Fetcher: vi.fn(),
  createSigv4FetchWithCredentials: vi.fn(),
  flexFetch: vi.fn(),
  typedFetch: vi.fn(),
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
