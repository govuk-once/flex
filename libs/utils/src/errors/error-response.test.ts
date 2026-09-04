import { describe, expect, it } from "vitest";
import type { ZodError } from "zod";

import {
  buildErrorResponse,
  ErrorResponseSchema,
  errorTypeForStatus,
  headersToErrorDetails,
  toErrorResponseBody,
  zodIssuesToErrorDetails,
} from "./error-response";

describe("buildErrorResponse", () => {
  it("returns message and type without errors when none provided", () => {
    expect(buildErrorResponse("client_error", "Bad request")).toEqual({
      message: "Bad request",
      type: "client_error",
    });
  });

  it("returns message and type without errors when empty array provided", () => {
    expect(buildErrorResponse("client_error", "Bad request", [])).toEqual({
      message: "Bad request",
      type: "client_error",
    });
  });

  it("includes errors array when non-empty", () => {
    const errors = [{ field: "email", message: "Invalid email" }];
    expect(
      buildErrorResponse("validation_error", "Validation failed", errors),
    ).toEqual({
      message: "Validation failed",
      type: "validation_error",
      errors: [{ field: "email", message: "Invalid email" }],
    });
  });

  it("copies errors array to avoid mutation", () => {
    const errors = [{ field: "name", message: "Required" }] as const;
    const result = buildErrorResponse("validation_error", "Failed", errors);
    expect(result.errors).not.toBe(errors);
    expect(result.errors).toEqual([...errors]);
  });
});

describe("headersToErrorDetails", () => {
  it("returns empty array for no headers", () => {
    expect(headersToErrorDetails([])).toEqual([]);
  });

  it("maps each header to an error detail with a fixed message", () => {
    expect(headersToErrorDetails(["x-api-key", "authorization"])).toEqual([
      { field: "x-api-key", message: "Required header missing" },
      { field: "authorization", message: "Required header missing" },
    ]);
  });
});

describe("zodIssuesToErrorDetails", () => {
  it("returns empty array for no issues", () => {
    expect(zodIssuesToErrorDetails([])).toEqual([]);
  });

  it("joins path segments with dots", () => {
    const issues: ZodError["issues"] = [
      {
        code: "invalid_type",
        expected: "string",
        path: ["user", "email"],
        message: "Expected string",
      },
    ];
    expect(zodIssuesToErrorDetails(issues)).toEqual([
      { field: "user.email", message: "Expected string" },
    ]);
  });

  it("handles single-segment path", () => {
    const issues: ZodError["issues"] = [
      {
        code: "invalid_type",
        expected: "string",
        path: ["name"],
        message: "Required",
      },
    ];
    expect(zodIssuesToErrorDetails(issues)).toEqual([
      { field: "name", message: "Required" },
    ]);
  });

  it("handles empty path", () => {
    const issues: ZodError["issues"] = [
      {
        code: "invalid_type",
        expected: "object",
        path: [],
        message: "Expected object",
      },
    ];
    expect(zodIssuesToErrorDetails(issues)).toEqual([
      { field: "", message: "Expected object" },
    ]);
  });
});

describe("errorTypeForStatus", () => {
  it.for([
    { status: 401, expected: "auth_error" },
    { status: 403, expected: "auth_error" },
    { status: 500, expected: "server_error" },
    { status: 502, expected: "server_error" },
    { status: 400, expected: "client_error" },
    { status: 404, expected: "client_error" },
    { status: 422, expected: "client_error" },
  ])("returns $expected for $status", ({ status, expected }) => {
    expect(errorTypeForStatus(status)).toBe(expected);
  });
});

describe("toErrorResponseBody", () => {
  it("uses string error as message directly", () => {
    expect(toErrorResponseBody(400, "Missing field")).toEqual({
      message: "Missing field",
      type: "client_error",
    });
  });

  it("extracts message from error object", () => {
    expect(toErrorResponseBody(400, { message: "Invalid input" })).toEqual({
      message: "Invalid input",
      type: "client_error",
    });
  });

  it("falls back to default message when error object has no message", () => {
    expect(toErrorResponseBody(400, { foo: "bar" })).toEqual({
      message: "Request failed",
      type: "client_error",
      foo: "bar",
    });
  });

  it("falls back to default message when message is not a string", () => {
    expect(toErrorResponseBody(500, { message: 123 })).toEqual({
      message: "Internal server error",
      type: "server_error",
    });
  });

  it("includes errors array from error object", () => {
    const input = {
      message: "Validation failed",
      errors: [{ field: "email", message: "Invalid" }],
    };
    expect(toErrorResponseBody(400, input)).toEqual({
      message: "Validation failed",
      type: "client_error",
      errors: [{ field: "email", message: "Invalid" }],
    });
  });

  it("preserves extra keys from the error object", () => {
    const input = { message: "Error", requestId: "abc-123", traceId: "xyz" };
    const result = toErrorResponseBody(400, input);
    expect(result.requestId).toBe("abc-123");
    expect(result.traceId).toBe("xyz");
  });

  it("strips type from extras to avoid duplication", () => {
    const input = { message: "Error", type: "should_be_stripped" };
    const result = toErrorResponseBody(400, input);
    expect(result.type).toBe("client_error");
  });

  it("returns default message for undefined error", () => {
    expect(toErrorResponseBody(500)).toEqual({
      message: "Internal server error",
      type: "server_error",
    });
  });

  it("returns default message for null error", () => {
    expect(toErrorResponseBody(401, null)).toEqual({
      message: "Unauthorized",
      type: "auth_error",
    });
  });

  it("returns default message for numeric error", () => {
    expect(toErrorResponseBody(403, 42)).toEqual({
      message: "Unauthorized",
      type: "auth_error",
    });
  });

  it("does not include errors key when errors is not an array", () => {
    const result = toErrorResponseBody(400, {
      message: "Fail",
      errors: "not-array",
    });
    expect(result.errors).toBeUndefined();
  });
});

describe("ErrorResponseSchema", () => {
  it("parses a valid response with errors", () => {
    const result = ErrorResponseSchema.safeParse({
      message: "Bad request",
      type: "client_error",
      errors: [{ field: "name", message: "Required" }],
    });
    expect(result.success).toBe(true);
  });

  it("parses a valid response without errors", () => {
    const result = ErrorResponseSchema.safeParse({
      message: "Not found",
      type: "client_error",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = ErrorResponseSchema.safeParse({
      message: "Error",
      type: "unknown_error",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing message", () => {
    const result = ErrorResponseSchema.safeParse({
      type: "client_error",
    });
    expect(result.success).toBe(false);
  });
});
