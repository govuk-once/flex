import type { TelemetryEvent } from "./events";
import type { TelemetryDetails } from "./telemetry";

export type { TelemetryEvent } from "./events";
export type { TelemetryDetails } from "./telemetry";

// CloudFront Functions are limited in size. This module minimizes what the
// CloudFront function has to import to a minimum.

export const CffTelemetryEvent = {
  cff_token_validated: "cff_token_validated",
  cff_token_missing: "cff_token_missing",
  cff_token_invalid: "cff_token_invalid",
} as const satisfies {
  [K in TelemetryEvent as K extends `cff_${string}` ? K : never]: K;
};

export function emitCffTelemetry(
  event: TelemetryEvent,
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
