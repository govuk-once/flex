import { beforeEach, describe, expect, it, vi } from "vitest";

describe("logging", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("preserves logger instance across setLogServiceName calls", async () => {
    const mod = await import(".");
    const original = mod.logger;
    mod.setLogServiceName("new-service");
    expect(mod.logger).toBe(original);
  });

  it("preserves logger instance across setLogLevel calls", async () => {
    const mod = await import(".");
    const original = mod.logger;
    mod.setLogLevel("DEBUG");
    expect(mod.logger).toBe(original);
  });
});
