import { beforeEach, describe, expect, it, vi } from "vitest";

describe("logging", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("exports a logger singleton", async () => {
    const mod = await import(".");
    expect(mod.logger).toBeDefined();
    expect(typeof mod.logger.info).toBe("function");
  });

  it("defaults to INFO log level", async () => {
    const mod = await import(".");
    expect(mod.logger.getLevelName()).toBe("INFO");
  });

  it("allows changing log level in non-production", async () => {
    const mod = await import(".");
    mod.logger.setLogLevel("DEBUG");
    expect(mod.logger.getLevelName()).toBe("DEBUG");
  });

  it("ignores setLogLevel in production", async () => {
    vi.stubEnv("FLEX_ENVIRONMENT", "production");
    const mod = await import(".");
    mod.logger.setLogLevel("DEBUG");
    expect(mod.logger.getLevelName()).toBe("INFO");
  });
});
