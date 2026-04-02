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

  it("sets log level on first call", async () => {
    const mod = await import(".");
    mod.setLogLevel("DEBUG");
    expect(mod.logger.getLevelName()).toBe("DEBUG");
  });

  it("ignores subsequent calls after log level has been set", async () => {
    const mod = await import(".");
    mod.setLogLevel("DEBUG");
    mod.setLogLevel("WARN");
    expect(mod.logger.getLevelName()).toBe("DEBUG");
  });

  it("warns when log level is set more than once", async () => {
    const mod = await import(".");
    const warnSpy = vi.spyOn(mod.logger, "warn");
    mod.setLogLevel("DEBUG");
    mod.setLogLevel("WARN");
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});
