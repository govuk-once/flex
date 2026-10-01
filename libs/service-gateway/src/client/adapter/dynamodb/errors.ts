import { TelemetryEvent } from "@flex/telemetry";
import { z } from "zod";

export abstract class DynamoDBOperationError extends Error {
  abstract readonly status: number;
  abstract readonly event: TelemetryEvent;
  readonly body?: unknown;

  get reason() {
    return this.message;
  }
}

abstract class ItemSchemaError extends DynamoDBOperationError {
  override readonly body: unknown;

  constructor(
    message: string,
    readonly issues: z.ZodError,
  ) {
    super(message);

    this.body = z.treeifyError(issues);
  }

  override get reason() {
    return z.prettifyError(this.issues);
  }
}

export class ItemValidationError extends ItemSchemaError {
  readonly status = 502;
  readonly event = TelemetryEvent.response_validation_failed;

  constructor(issues: z.ZodError) {
    super("Response validation failed", issues);

    this.name = "ItemValidationError";
  }
}

export class ItemInputError extends ItemSchemaError {
  readonly status = 400;
  readonly event = TelemetryEvent.request_validation_failed;

  constructor(issues: z.ZodError) {
    super("Item validation failed", issues);

    this.name = "ItemInputError";
  }
}

export class DynamoDBUsageError extends DynamoDBOperationError {
  readonly status = 500;
  readonly event = TelemetryEvent.error_thrown;

  constructor(message: string) {
    super(message);

    this.name = "DynamoDBUsageError";
  }
}

const THROTTLING_EXCEPTION_CODES = new Set([
  "ProvisionedThroughputExceededException",
  "RequestLimitExceeded",
  "ThrottlingException",
]);

export const toGatewayError = ({ name, message }: Error) =>
  THROTTLING_EXCEPTION_CODES.has(name)
    ? { status: 429, message: "Too many requests" }
    : { status: 502, message };

export const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));
