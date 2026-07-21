import type { Mock } from "vitest";
import { vi } from "vitest";

export { TelemetryEvent, TelemetryEventSchema } from "../events";

export const emitTelemetry: Mock = vi.fn();
