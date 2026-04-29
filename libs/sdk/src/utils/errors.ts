import type { ZodError } from "zod";

export class HeaderValidationError extends Error {
  readonly statusCode = 400;
  readonly headers: readonly string[];

  constructor(headers: readonly string[]) {
    super(`Missing headers: ${headers.join(", ")}`);

    this.name = "HeaderValidationError";
    this.headers = headers;
  }
}

export class RequestBodyParseError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);

    this.name = "RequestBodyParseError";
  }
}

export class QueryParametersParseError extends Error {
  readonly statusCode = 400;
  readonly errors: { readonly field: string; readonly message: string }[];

  constructor({ issues }: ZodError) {
    super("Invalid query parameters");

    this.name = "QueryParametersParseError";
    this.errors = issues.map(({ message, path }) => ({
      field: path.join("."),
      message,
    }));
  }
}

export class AuthorizationError extends Error {
  readonly statusCode = 401;

  constructor() {
    super("Failed to extract the pairwise ID from the request context");

    this.name = "AuthorizationError";
  }
}
