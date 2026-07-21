import { EdgeTelemetryEvent } from "@flex/telemetry/edge";

import { validationError } from "../utils/errors";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeParseJson(jsonString: string) {
  try {
    return JSON.parse(jsonString) as Record<string, unknown>;
  } catch {
    // Handle error above
  }
}

/**
 * Attempts to parse a JSON string and returns the resulting object or null if parsing fails.
 *
 * @param jsonString - The JSON string to parse.
 * @returns The parsed object or null if parsing fails.
 */
export function validateJson(
  jsonString: string,
  message: string,
): Record<string, unknown> {
  const result = safeParseJson(jsonString);

  if (!isObject(result)) {
    throw validationError(message, EdgeTelemetryEvent.edge_token_invalid);
  }

  return result;
}
