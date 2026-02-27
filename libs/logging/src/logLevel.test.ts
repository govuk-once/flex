import { describe, expect, it } from "vitest";

import { clampLogLevel } from "./logLevel";

describe("clampLogLevel", () => {
  it("returns the requested level when within range", () => {
    expect(clampLogLevel("DEBUG", "INFO", "TRACE")).toBe("DEBUG");
  });

  it("clamps to floor when requested is quieter than floor", () => {
    expect(clampLogLevel("WARN", "INFO", "TRACE")).toBe("INFO");
  });

  it("clamps to ceiling when requested is noisier than ceiling", () => {
    expect(clampLogLevel("TRACE", "INFO", "DEBUG")).toBe("DEBUG");
  });

  it("clamps to floor when both floor and ceiling apply", () => {
    expect(clampLogLevel("SILENT", "INFO", "DEBUG")).toBe("INFO");
  });

  it("handles case insensitivity", () => {
    expect(clampLogLevel("debug", "info", "trace")).toBe("DEBUG");
    expect(clampLogLevel("Debug", "Info", "Trace")).toBe("DEBUG");
  });

  it("defaults to INFO for invalid requested level", () => {
    expect(clampLogLevel("INVALID", "INFO", "TRACE")).toBe("INFO");
  });

  it("defaults floor to INFO for invalid floor value", () => {
    expect(clampLogLevel("ERROR", "INVALID", "TRACE")).toBe("INFO");
  });

  it("defaults ceiling to TRACE for invalid ceiling value", () => {
    expect(clampLogLevel("DEBUG", "INFO", "INVALID")).toBe("DEBUG");
  });

  it("returns exact floor when requested equals floor", () => {
    expect(clampLogLevel("INFO", "INFO", "TRACE")).toBe("INFO");
  });

  it("returns exact ceiling when requested equals ceiling", () => {
    expect(clampLogLevel("DEBUG", "INFO", "DEBUG")).toBe("DEBUG");
  });

  it("handles CRITICAL level", () => {
    expect(clampLogLevel("CRITICAL", "INFO", "TRACE")).toBe("INFO");
  });

  it("allows SILENT as floor to permit silencing logs", () => {
    expect(clampLogLevel("SILENT", "SILENT", "TRACE")).toBe("SILENT");
  });
});
