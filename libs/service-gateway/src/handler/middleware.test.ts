import { injectLambdaContext, logger } from "@flex/logging";
import { describe, expect, it, vi } from "vitest";

import type { MiddlewareOptions } from "./middleware";
import { buildMiddleware } from "./middleware";

const mockInstance = vi.hoisted(() => {
  const middleware = { use: vi.fn(() => middleware) };
  return middleware;
});
const mockMiddy = vi.hoisted(() => vi.fn(() => mockInstance));
vi.mock("@middy/core", () => ({ default: mockMiddy }));

const loggingMiddleware = vi.hoisted(() => ({ before: vi.fn() }));
vi.mock("@flex/logging", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@flex/logging")>()),
  injectLambdaContext: vi.fn(() => loggingMiddleware),
}));

const createMiddlewareOptions = (
  overrides?: Partial<MiddlewareOptions>,
): MiddlewareOptions => ({ logger, ...overrides });

describe("buildMiddleware", () => {
  it("returns the configured middleware instance", () => {
    expect(buildMiddleware(createMiddlewareOptions())).toBe(mockInstance);
  });

  it("registers the logging middleware", () => {
    buildMiddleware(createMiddlewareOptions());

    expect(injectLambdaContext).toHaveBeenCalledExactlyOnceWith(logger, {
      clearState: true,
      correlationIdPath: 'headers."x-correlation-id"',
    });
    expect(mockInstance.use).toHaveBeenCalledExactlyOnceWith(loggingMiddleware);
  });
});
