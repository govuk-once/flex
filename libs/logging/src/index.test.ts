import { beforeEach, describe, expect, it, vi } from "vitest";

describe("logging", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("preserves logger instance across setLogServiceName calls", async () => {
    const mod = await import(".");
    const original = mod.logger("new-service", "DEBUG");
    expect(mod.logger()).toBe(original);
  });

  it("sets log level on first call", async () => {
    const mod = await import(".");
    mod.logger("new-service", "DEBUG");
    expect(mod.logger().getLevelName()).toBe("DEBUG");
  });

  it("ignores subsequent calls after log level has been set", async () => {
    const mod = await import(".");
    mod.logger("new-service", "DEBUG");
    expect(mod.logger("new-service", "INFO").getLevelName()).toBe("DEBUG");
  });

  it("warns when log level is set more than once", async () => {
    const mod = await import(".");
    const instance = mod.logger("new-service", "DEBUG");
    const warnSpy = vi.spyOn(instance, "warn");
    mod.logger("new-service", "WARN");
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});
