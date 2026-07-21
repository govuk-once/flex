import { logger } from "@flex/logging";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TelemetryEvent } from "./events";
import { emitTelemetry } from "./telemetry";

vi.mock("@flex/logging");

describe("emitTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs the event under the telemetry namespace", () => {
    emitTelemetry(TelemetryEvent.example_event, { userId: "123" });

    expect(logger.info).toHaveBeenCalledExactlyOnceWith("telemetry", {
      telemetry: {
        event: TelemetryEvent.example_event,
        details: { userId: "123" },
      },
    });
  });

  it("omits details when none are provided", () => {
    emitTelemetry(TelemetryEvent.example_event);

    expect(logger.info).toHaveBeenCalledExactlyOnceWith("telemetry", {
      telemetry: { event: TelemetryEvent.example_event },
    });
  });
});
