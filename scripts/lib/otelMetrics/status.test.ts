import { describe, expect, it } from "vitest";

import {
  describeResult,
  isRunning,
  NOT_CONFIGURED,
  resourceTagsNotFoundAsOff,
  stateProblem,
} from "./status";

describe("resourceTagsNotFoundAsOff", () => {
  const notFound = {
    ok: false,
    error:
      "aws: [ERROR]: An error occurred (ResourceNotFoundException) when calling the GetTelemetryEnrichmentStatus operation: TelemetryEnrichmentStatus is not found",
  } as const;

  it("reads a never-enabled account as not configured, not as an error", () => {
    const result = resourceTagsNotFoundAsOff(notFound);
    expect(result).toEqual({ ok: true, value: { Status: NOT_CONFIGURED } });
    expect(isRunning(result)).toBe(false);
  });

  it("lets the state check pass when resource tags were never enabled", () => {
    expect(
      stateProblem({
        identity: { ok: true, value: { Account: "123456789012" } },
        resourceTags: resourceTagsNotFoundAsOff(notFound),
        otel: { ok: true, value: { Status: "Stopped" } },
      }),
    ).toBeUndefined();
  });

  it.each([
    ["another error", { ok: false, error: "AccessDeniedException" }],
    ["a status", { ok: true, value: { Status: "Running" } }],
  ] as const)("keeps %s unchanged", (_, result) => {
    expect(resourceTagsNotFoundAsOff(result)).toBe(result);
  });
});

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
