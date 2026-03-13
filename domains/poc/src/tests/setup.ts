import nock from "nock";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";

vi.mock("@middy/secrets-manager", () => ({
  default: () => ({ before: vi.fn() }),
  secret: vi.fn((v: string) => v),
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
  expect(nock.isDone()).toBe(true);
  nock.cleanAll();
});
