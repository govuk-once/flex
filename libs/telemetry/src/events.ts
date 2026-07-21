import { z } from "zod";

// Placeholder entry: z.enum requires at least one value. Real event names
// land as telemetry is wired into the platform.
export const TelemetryEventSchema = z.enum(["example_event"]);
export type TelemetryEvent = z.output<typeof TelemetryEventSchema>;
export const TelemetryEvent = TelemetryEventSchema.enum;
