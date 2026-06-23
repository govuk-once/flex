export class AuthorizationError extends Error {
  readonly statusCode = 401;

  constructor() {
    super("Failed to extract the pairwise ID from the request context");

    this.name = "AuthorizationError";
  }
}
