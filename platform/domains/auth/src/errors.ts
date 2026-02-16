/**
 * Thrown when JWT validation fails (missing token, invalid JWT, expired, wrong
 * signature, missing claims). These errors result in an explicit Deny from the
 * authorizer (403 to the client).
 */
export class JwtValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwtValidationError";
    Object.setPrototypeOf(this, JwtValidationError.prototype);
  }
}
