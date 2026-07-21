import type { TelemetryEvent } from "./events";
import type { TelemetryDetails } from "./telemetry";

export type { TelemetryEvent } from "./events";
export type { TelemetryDetails } from "./telemetry";

// Edge functions are limited in size. This module minimizes what the edge
// function has to import to a minimum.

export const EdgeTelemetryEvent = {
  edge_token_validated: "edge_token_validated",
  edge_token_missing: "edge_token_missing",
  edge_token_invalid: "edge_token_invalid",
} as const satisfies {
  [K in TelemetryEvent as K extends `edge_${string}` ? K : never]: K;
};

export function emitEdgeTelemetry(
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
