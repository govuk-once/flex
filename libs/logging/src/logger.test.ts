import { Logger as PowerToolsLogger } from "@aws-lambda-powertools/logger";
import { describe, expect, it, vi } from "vitest";

import { Logger } from "./logger";

vi.mock("@aws-lambda-powertools/logger", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@aws-lambda-powertools/logger")>();

  const LoggerSpy = vi.fn(actual.Logger);
  Object.setPrototypeOf(LoggerSpy.prototype, actual.Logger.prototype);

  return { ...actual, Logger: LoggerSpy };
});

describe("Logger", () => {
  it("should create a logger instance with the specified service name and log level", () => {
    new Logger({
      serviceName: "test-service",
      logLevel: "INFO",
    });

    expect(PowerToolsLogger).toBeCalledWith({
      serviceName: "test-service",
      logLevel: "INFO",
    });
  });

  it("should not allow changing log level", () => {
    const baseSetLogLevel = vi.spyOn(
      Object.getPrototypeOf(PowerToolsLogger.prototype),
      "setLogLevel",
    );

    const logger = new Logger({
      serviceName: "test-service",
      logLevel: "INFO",
    });

    logger.setLogLevel("DEBUG");

    expect(baseSetLogLevel).not.toHaveBeenCalled();
    expect(logger.getLevelName()).toBe("INFO");
  });
});
