import type { ZodError } from "zod";

import { type ErrorDetail, zodIssuesToErrorDetails } from "./error-response";

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
  readonly errors: readonly ErrorDetail[];

  constructor({ issues }: ZodError) {
    super("Invalid query parameters");

    this.name = "QueryParametersParseError";
    this.errors = zodIssuesToErrorDetails(issues);
  }
}
