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

  describe("redaction via jsonReplacerFn", () => {
    const capture = async (
      log: (logger: typeof import(".").logger) => void,
    ): Promise<Record<string, unknown>> => {
      const mod = await import(".");
      const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
      log(mod.logger);
      const written = spy.mock.calls.map((call) => String(call[0])).join("");
      spy.mockRestore();

      const line = written.split("\n").filter(Boolean).at(-1) ?? "{}";
      return JSON.parse(line) as Record<string, unknown>;
    };

    it("redacts sensitive keys at serialization, including nested branches", async () => {
      const entry = await capture((logger) => {
        logger.info("processing request", {
          credentials: { apiKey: "leak", inner: { deep: "leak" } }, // pragma: allowlist secret
          request: { headers: { authorization: "Bearer x" }, path: "/health" },
          tokens: ["a", "b"], // pragma: allowlist secret
          safe: { count: 42 },
        });
      });

      expect(entry.message).toBe("processing request");
      expect(entry.credentials).toBe("***REDACTED***");
      expect(entry.tokens).toBe("***REDACTED***");
      expect(entry.request).toEqual({
        headers: { authorization: "***REDACTED***" },
        path: "/health",
      });
      expect(entry.safe).toEqual({ count: 42 });
    });
  });
});
