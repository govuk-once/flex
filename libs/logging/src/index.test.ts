import { Logger } from "@aws-lambda-powertools/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("logging", () => {
  let createLogger: typeof import(".").createLogger;
  let getLogger: typeof import(".").getLogger;
  let getChildLogger: typeof import(".").getChildLogger;

  beforeEach(async () => {
    vi.resetModules();
    const loggerModule = await import(".");
    createLogger = loggerModule.createLogger;
    getLogger = loggerModule.getLogger;
    getChildLogger = loggerModule.getChildLogger;
  });

  describe("createLogger", () => {
    it("creates a new logger instance", () => {
      const logger = createLogger({
        logLevel: "INFO",
        serviceName: "test-service",
      });
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe("getLogger", () => {
    it("throws with a helpful message when called before createLogger", () => {
      expect(() => getLogger()).toThrow(
        "Logger not initialized. Call createLogger() in your createLambdaHandler config.",
      );
    });

    it("returns the instance created by createLogger", () => {
      const logger = createLogger({
        logLevel: "INFO",
        serviceName: "test-service",
      });
      expect(getLogger()).toBe(logger);
    });
  });

  describe("getChildLogger", () => {
    it("creates a child logger from the cached logger", () => {
      const logger = createLogger({
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
