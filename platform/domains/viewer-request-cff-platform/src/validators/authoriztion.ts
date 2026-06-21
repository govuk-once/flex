/**
 * Validates an Authorization value and returns the token part
 *
 * @param authorization - The authorization value.
 * @returns A token extracted from the authoization value.
 */
export function validateAuthorization(authorization?: string) {
  if (!authorization) {
    throw new Error("No authorization value provided");
  }

  // destructuring is not supported in CloudFront Functions
  const headerParts = authorization.split(" ");
  const bearerLabel = headerParts[0];
  const token = headerParts[1];
  const rest = headerParts.slice(2);

  if (bearerLabel !== "Bearer") {
    throw new Error("Authorization value does not start with 'Bearer'");
  }

  if (rest.length > 0) {
    throw new Error("Authorization value has too many segments'");
  }

  if (!token) {
    throw new Error("No token provided in authorization header");
  }

  return token;
}
