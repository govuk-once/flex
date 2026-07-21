import { EdgeTelemetryEvent } from "@flex/telemetry/edge";

import { validationError } from "../utils/errors";

/**
 * Validates an Authorization value and returns the token part
 *
 * @param authorization - The authorization value.
 * @returns A token extracted from the authoization value.
 */
export function validateAuthorization(authorization?: string) {
  if (!authorization) {
    throw validationError(
      "No authorization value provided",
      EdgeTelemetryEvent.edge_token_missing,
    );
  }

  // destructuring is not supported in CloudFront Functions
  const headerParts = authorization.split(" ");
  const bearerLabel = headerParts[0];
  const token = headerParts[1];
  const rest = headerParts.slice(2);

  if (bearerLabel !== "Bearer") {
    throw validationError(
      "Authorization value does not start with 'Bearer'",
      EdgeTelemetryEvent.edge_token_invalid,
    );
  }

  if (rest.length > 0) {
    throw validationError(
      "Authorization value has too many segments'",
      EdgeTelemetryEvent.edge_token_invalid,
    );
  }

  if (!token) {
    throw validationError(
      "No token provided in authorization header",
      EdgeTelemetryEvent.edge_token_missing,
    );
  }

  return token;
}
