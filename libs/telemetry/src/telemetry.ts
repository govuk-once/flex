import { logger } from "@flex/logging";

import type { TelemetryEvent } from "./events";

export type TelemetryDetails = Record<string, unknown>;

export function emitTelemetry(
  event: TelemetryEvent,
  details?: TelemetryDetails,
): void {
  logger.info("telemetry", {
    telemetry: { event, ...(details && { details }) },
  });
}
