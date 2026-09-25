import { TelemetryEvent } from "@flex/telemetry";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  DynamoDBUsageError,
  ItemInputError,
  ItemValidationError,
  toError,
  toGatewayError,
} from "./errors";

const buildIssues = (): z.ZodError => {
  const result = z.object({ slug: z.string() }).safeParse({ slug: 42 });

  if (result.success) throw new Error("Expected the item to fail validation");

  return result.error;
};

const issues = buildIssues();

describe("ItemValidationError", () => {
  it("reports a stored item we cannot read as an upstream fault", () => {
    const error = new ItemValidationError(issues);

    expect(error.status).toBe(502);
    expect(error.event).toBe(TelemetryEvent.response_validation_failed);
    expect(error.message).toBe("Response validation failed");
  });

  it("logs which attribute failed and carries the same on the result", () => {
    const error = new ItemValidationError(issues);

    expect(error.reason).toContain("slug");
    expect(error.body).toMatchObject({
      properties: { slug: expect.anything() as unknown },
    });
  });
});

describe("ItemInputError", () => {
  it("reports an item we were asked to write as the caller's fault", () => {
    const error = new ItemInputError(issues);

    expect(error.status).toBe(400);
    expect(error.event).toBe(TelemetryEvent.request_validation_failed);
    expect(error.message).toBe("Item validation failed");
    expect(error.reason).toContain("slug");
  });
});

describe("DynamoDBUsageError", () => {
  it("reports our own mistake as a 500, with nothing for the caller", () => {
    const error = new DynamoDBUsageError("A key must name the partition key");

    expect(error.status).toBe(500);
    expect(error.event).toBe(TelemetryEvent.error_thrown);
    expect(error.reason).toBe("A key must name the partition key");
    expect(error.body).toBeUndefined();
  });
});

describe("toGatewayError", () => {
  it.each([
    "ProvisionedThroughputExceededException",
    "RequestLimitExceeded",
    "ThrottlingException",
  ])("asks the caller to come back later after a %s", (name) => {
    const error = new Error("Throughput exceeds the current capacity");

    error.name = name;

    expect(toGatewayError(error)).toStrictEqual({
      status: 429,
      message: "Too many requests",
    });
  });

  it("keeps a malformed request to ourselves rather than blaming the caller", () => {
    const error = new Error("ExpressionAttributeValues contains invalid value");

    error.name = "ValidationException";

    expect(toGatewayError(error)).toStrictEqual({
      status: 502,
      message: "ExpressionAttributeValues contains invalid value",
    });
  });

  it("collapses every other AWS fault to 502", () => {
    const error = new Error("Requested resource not found");

    error.name = "ResourceNotFoundException";

    expect(toGatewayError(error)).toMatchObject({ status: 502 });
  });
});

describe("toError", () => {
  it("passes an Error through untouched", () => {
    const error = new Error("ResourceNotFoundException");

    expect(toError(error)).toBe(error);
  });

  it("wraps a rejection that is not an Error, as the SDK can produce", () => {
    expect(toError("socket hang up")).toStrictEqual(
      new Error("socket hang up"),
    );
    expect(toError(undefined).message).toBe("undefined");
  });
});
