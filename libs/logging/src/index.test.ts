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
    it("throws with a helpful message when called without options before initialization", () => {
      expect(() => getLogger()).toThrow(
        "Logger not initialized. Pass { serviceName, logLevel } to getLogger() in your createLambdaHandler config.",
      );
    });

    it("creates a new logger instance when called with options", () => {
      const logger = getLogger({
        logLevel: "INFO",
        serviceName: "test-service",
      });
      expect(logger).toBeInstanceOf(Logger);
    });

    it("returns the same instance on subsequent calls without options", () => {
      const logger = getLogger({
        logLevel: "INFO",
        serviceName: "test-service",
      });
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

    it("throws when called before logger is initialized", () => {
      expect(() => getChildLogger({ foo: "bar" })).toThrow(
        "Logger not initialized.",
      );
    });
  });
});
