import { beforeEach, describe, expect, it, vi } from "vitest";

import { CffTelemetryEvent, emitCffTelemetry } from "./cff";

describe("emitCffTelemetry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("writes the telemetry shape to console.log", () => {
    const log = vi
      .spyOn(console, "log")
      .mockImplementationOnce(() => undefined);

    emitCffTelemetry(CffTelemetryEvent.cff_token_validated, {
      correlationId: "abc",
    });

    expect(log).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(log.mock.calls[0]?.[0] as string) as unknown;
    expect(parsed).toEqual({
      level: "INFO",
      message: "telemetry",
      telemetry: {
        event: "cff_token_validated",
        details: { correlationId: "abc" },
      },
    });
  });

  it("omits details when none are provided", () => {
    const log = vi
      .spyOn(console, "log")
      .mockImplementationOnce(() => undefined);

    emitCffTelemetry(CffTelemetryEvent.cff_token_invalid);

    expect(log).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(log.mock.calls[0]?.[0] as string) as unknown;
    expect(parsed).toEqual({
      level: "INFO",
      message: "telemetry",
      telemetry: { event: "cff_token_invalid" },
    });
  });
});
