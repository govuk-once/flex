import type { Mock } from "vitest";
import { vi } from "vitest";

export type { TelemetryDetails } from "../cff";
export { CffTelemetryEvent } from "../cff";

export const emitCffTelemetry: Mock = vi.fn();
