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
    emitTelemetry(TelemetryEvent.auth_success, { userId: "123" });

    expect(logger.info).toHaveBeenCalledExactlyOnceWith("telemetry", {
      telemetry: {
        event: TelemetryEvent.auth_success,
        details: { userId: "123" },
      },
    });
  });

  it("omits details when none are provided", () => {
    emitTelemetry(TelemetryEvent.auth_success);

    expect(logger.info).toHaveBeenCalledExactlyOnceWith("telemetry", {
      telemetry: { event: TelemetryEvent.auth_success },
    });
  });
});
