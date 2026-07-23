import { CffTelemetryEvent } from "@flex/telemetry/cff";

import { validationError } from "../utils/errors";
import { validateJson } from "./json";

/**
 * Decodes a JWT token into its constituent parts: header, body, and signature.
 *
 * @param maybeJwt - The JWT token string.
 * @returns An object containing the decoded header, body, and a flag indicating if the signature is present.
 */
export function validateJwt(maybeJwt: string) {
  // destructuring is not supported in CloudFront Functions, so we have to do it manually
  const tokenParts = maybeJwt.split(".");
  const header = tokenParts[0];
  const body = tokenParts[1];
  const signature = tokenParts[2];
  const rest = tokenParts.slice(3);

  if (rest.length > 0) {
    throw validationError(
      "Invalid JWT: too many segments: " + JSON.stringify(rest),
      CffTelemetryEvent.cff_token_invalid,
    );
  }

  if (!header) {
    throw validationError(
      "Invalid JWT: missing header",
      CffTelemetryEvent.cff_token_invalid,
    );
  }

  if (!body) {
    throw validationError(
      "Invalid JWT: missing body",
      CffTelemetryEvent.cff_token_invalid,
    );
  }

  if (!signature) {
    throw validationError(
      "Invalid JWT: missing signature",
      CffTelemetryEvent.cff_token_invalid,
    );
  }

  const parsedHeader = validateJson(
    Buffer.from(header, "base64").toString(),
    "Invalid JWT: header is not valid JSON",
  );

  if (parsedHeader.alg === "none") {
    throw validationError(
      "Invalid JWT: Unsecure JWTs are not allowed",
      CffTelemetryEvent.cff_token_invalid,
    );
  }

  const parsedBody = validateJson(
    Buffer.from(body, "base64").toString(),
    "Invalid JWT: body is not valid JSON",
  );

  return {
    header: parsedHeader,
    body: parsedBody,
    signaturePresent: Boolean(signature),
  };
}
