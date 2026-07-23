import type { CffTelemetryEvent } from "@flex/telemetry/cff";

export interface ValidationError extends Error {
  telemetryEvent: CffTelemetryEvent;
}

/**
 * Builds an Error tagged with the telemetry event describing the failure.
 *
 * @param message - The error message
 * @param telemetryEvent - the telemetry event this should be filed under
 */
export function validationError(
  message: string,
  telemetryEvent: CffTelemetryEvent,
): ValidationError {
  const error = new Error(message) as ValidationError;
  error.telemetryEvent = telemetryEvent;
  return error;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof Error && "telemetryEvent" in error;
}
