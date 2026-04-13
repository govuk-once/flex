import { Logger as PowerToolsLogger } from "@aws-lambda-powertools/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FlexLogFormatter } from "./formatter";
import { logger } from "./logger";

vi.mock("./formatter", () => ({
  FlexLogFormatter: class {
    setServiceName() {}
  },
}));

describe("FlexLogger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    logger.setLogLevel("INFO");
  });

  it("initialises with INFO log level", () => {
    expect(logger.getLevelName()).toBe("INFO");
  });

  describe("setLogLevel", () => {
    it("delegates to PowerTools in non-production", () => {
      const spy = vi.spyOn(PowerToolsLogger.prototype, "setLogLevel");

      logger.setLogLevel("DEBUG");

      expect(spy).toHaveBeenCalledExactlyOnceWith("DEBUG");
      expect(logger.getLevelName()).toBe("DEBUG");
    });

    it("is a no-op in production", () => {
      vi.stubEnv("FLEX_ENVIRONMENT", "production");
      const spy = vi.spyOn(PowerToolsLogger.prototype, "setLogLevel");

      logger.setLogLevel("DEBUG");

      expect(spy).not.toHaveBeenCalled();
      expect(logger.getLevelName()).toBe("INFO");
    });
  });

  describe("setServiceName", () => {
    it("delegates to the formatter", () => {
      const spy = vi.spyOn(FlexLogFormatter.prototype, "setServiceName");

      logger.setServiceName("my-service");

      expect(spy).toHaveBeenCalledExactlyOnceWith("my-service");
    });
  });
});
