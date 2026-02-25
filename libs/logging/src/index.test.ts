import { Logger } from "@aws-lambda-powertools/logger";
import { describe, expect, it, vi } from "vitest";

async function setup() {
  vi.resetModules();
  const { createLogger, getLogger, getChildLogger } = await import(".");
  return { createLogger, getLogger, getChildLogger };
}

describe("logging", () => {
  describe("createLogger", () => {
    it("creates a new logger instance", async () => {
      const { createLogger } = await setup();
      const logger = createLogger({
        logLevel: "INFO",
        serviceName: "test-service",
      });
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe("getLogger", () => {
    it("throws with a helpful message when called before createLogger", async () => {
      const { getLogger } = await setup();
      expect(() => getLogger()).toThrow(
        "Logger not initialized. Call createLogger() in your createLambdaHandler config.",
      );
    });

    it("returns the instance created by createLogger", async () => {
      const { createLogger, getLogger } = await setup();
      const logger = createLogger({
        logLevel: "INFO",
        serviceName: "test-service",
      });
      expect(getLogger()).toBe(logger);
    });
  });

  describe("getChildLogger", () => {
    it("creates a child logger from the cached logger", async () => {
      const { createLogger, getChildLogger } = await setup();
      const logger = createLogger({
        logLevel: "INFO",
        serviceName: "test-service",
      });
      const child = getChildLogger({ foo: "bar" });
      expect(child).toBeInstanceOf(Logger);
      expect(child).not.toBe(logger);
    });

    it("throws when called before logger is initialized", async () => {
      const { getChildLogger } = await setup();
      expect(() => getChildLogger({ foo: "bar" })).toThrow(
        "Logger not initialized.",
      );
    });
  });
});
