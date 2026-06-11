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
    throw new Error("Invalid JWT: too many segments: " + JSON.stringify(rest));
  }

  if (!header) {
    throw new Error("Invalid JWT: missing header");
  }

  if (!body) {
    throw new Error("Invalid JWT: missing body");
  }

  if (!signature) {
    throw new Error("Invalid JWT: missing signature");
  }

  const parsedHeader = validateJson(
    Buffer.from(header, "base64").toString(),
    "Invalid JWT: header is not valid JSON",
  );

  if (parsedHeader.alg === "none") {
    throw new Error("Invalid JWT: Unsecure JWTs are not allowed");
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
