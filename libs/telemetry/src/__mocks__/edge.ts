import type { Mock } from "vitest";
import { vi } from "vitest";

export type { TelemetryDetails, TelemetryEvent } from "../edge";
export { EdgeTelemetryEvent } from "../edge";

export const emitEdgeTelemetry: Mock = vi.fn();
