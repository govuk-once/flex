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
  public readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "RequestBodyParseError";
  }
}
