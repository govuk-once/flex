import type { TelemetryDetails } from "./telemetry";

export type { TelemetryDetails } from "./telemetry";

// CloudFront Functions are limited in size. This module minimizes what the
// CloudFront function has to import to a minimum.

// The single registry of CloudFront Function events, kept out of
// TelemetryEventSchema because the zod enum cannot be bundled into a
// CloudFront Function.
export const CffTelemetryEvent = {
  cff_token_validated: "cff_token_validated",
  cff_token_missing: "cff_token_missing",
  cff_token_invalid: "cff_token_invalid",
} as const satisfies { [K in `cff_${string}`]?: K };

export type CffTelemetryEvent = keyof typeof CffTelemetryEvent;

export function emitCffTelemetry(
  event: CffTelemetryEvent,
  details?: TelemetryDetails,
): void {
  const telemetry: Record<string, unknown> = { event };
  if (details) {
    telemetry.details = details;
  }

  console.log(
    JSON.stringify({ level: "INFO", message: "telemetry", telemetry }),
  );
}
