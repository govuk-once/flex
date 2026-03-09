import type { Mock } from "vitest";
import { vi } from "vitest";

export const logger: Record<string, Mock | Record<string, Mock>> = {
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  critical: vi.fn(),
  getLevelName: vi.fn().mockReturnValue("INFO"),
  createChild: vi.fn().mockReturnValue({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
  }),
  appendKeys: vi.fn(),
};

export const setLogServiceName: Mock = vi.fn();
export const setLogLevel: Mock = vi.fn();
export const createChildLogger: Mock = vi.fn().mockReturnValue({
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  critical: vi.fn(),
});
export const addSecretValue: Mock = vi.fn();
export const injectLambdaContext: Mock = vi.fn();
