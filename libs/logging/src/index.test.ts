import { Logger } from "@aws-lambda-powertools/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("logging", () => {
  let getLogger: typeof import(".").getLogger;
  let getChildLogger: typeof import(".").getChildLogger;

  beforeEach(async () => {
    vi.resetModules();
    const loggerModule = await import(".");
    getLogger = loggerModule.getLogger;
    getChildLogger = loggerModule.getChildLogger;
  });

  describe("getLogger", () => {
    it("throws when getLogger is called without options before initialization", () => {
      expect(() => getLogger()).toThrow(
        "Logger instance not initialized. Call getLogger with options first.",
      );
    });

    it("returns the same logger instance when created with options", () => {
      const logger = getLogger({
        logLevel: "INFO",
        serviceName: "test-service",
      });
      expect(logger).toBeInstanceOf(Logger);
      expect(getLogger()).toBe(logger);
    });
  });

  describe("getChildLogger", () => {
    it("creates a child logger from the cached logger", () => {
      const logger = getLogger({
        logLevel: "INFO",
        serviceName: "test-service",
      });
      const child = getChildLogger({ foo: "bar" });
      expect(child).toBeInstanceOf(Logger);
      expect(child).not.toBe(logger);
    });

    it("throws when getChildLogger is called before logger is initialized", () => {
      expect(() => getChildLogger({ foo: "bar" })).toThrow(
        "Logger instance not initialized. Call getLogger first.",
      );
    });
  });
});
