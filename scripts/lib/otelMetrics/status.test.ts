import { describe, expect, it } from "vitest";

import { describeResult, isRunning } from "./status";

describe("isRunning", () => {
  it.each(["Running", "RUNNING", "running"])("accepts %s", (status) => {
    expect(isRunning({ ok: true, value: { Status: status } })).toBe(true);
  });

  it.each([
    ["Stopped", { ok: true, value: { Status: "Stopped" } }],
    ["Impaired", { ok: true, value: { Status: "Impaired" } }],
    ["no status", { ok: true, value: {} }],
    ["a failed call", { ok: false, error: "AccessDenied" }],
  ] as const)("rejects %s", (_, result) => {
    expect(isRunning(result)).toBe(false);
  });
});

describe("describeResult", () => {
  it("describes a successful value", () => {
    expect(
      describeResult(
        { ok: true, value: 3 },
        (value) => `count ${String(value)}`,
      ),
    ).toBe("count 3");
  });

  it("uses the first non-empty line of an error", () => {
    expect(
      describeResult(
        { ok: false, error: "\n\nAn error occurred (AccessDenied)\ndetail" },
        String,
      ),
    ).toBe("error: An error occurred (AccessDenied)");
  });

  it("uses the whole error when every line is blank", () => {
    expect(describeResult({ ok: false, error: " " }, String)).toBe("error:  ");
  });
});
