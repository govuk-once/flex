import { describe, expect, it, vi } from "vitest";

import { TelemetryEvent } from "./events";
import { emitTelemetry } from "./telemetry";

describe("emitted log shape", () => {
  it("produces an analytics-queryable JSON line via the real logger", () => {
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementationOnce(() => true);

    emitTelemetry(TelemetryEvent.auth_success, { userId: "123" });

    const line = write.mock.calls
      .map((call) => String(call[0]))
      .find((entry) => entry.includes('"telemetry"'));

    expect(line).toBeDefined();
    const parsed = JSON.parse(line as string) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      level: "INFO",
      message: "telemetry",
      telemetry: {
        event: "auth_success",
        details: { userId: "123" },
      },
    });
    expect(parsed).toHaveProperty("timestamp");
    expect(parsed).toHaveProperty("service");
  });
});
