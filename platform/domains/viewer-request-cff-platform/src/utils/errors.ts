import type { TelemetryEvent } from "@flex/telemetry/edge";

export interface ValidationError extends Error {
  telemetryEvent: TelemetryEvent;
}

/**
 * Builds an Error tagged with the telemetry event describing the failure.
 *
 * @param message - The error message
 * @param telemetryEvent - the telemetry event this should be filed under
 */
export function validationError(
  message: string,
  telemetryEvent: TelemetryEvent,
): ValidationError {
  const error = new Error(message) as ValidationError;
  error.telemetryEvent = telemetryEvent;
  return error;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof Error && "telemetryEvent" in error;
}
