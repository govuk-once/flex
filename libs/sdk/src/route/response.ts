import type { ErrorResponse } from "@flex/utils";
import { toErrorResponseBody, zodIssuesToErrorDetails } from "@flex/utils";
import type { ZodType } from "zod";

import type { HandlerResult, LambdaResult } from "../types";

export function errorResult(
  statusCode: number,
  body: ErrorResponse,
): LambdaResult {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function toApiGatewayResponse(result: HandlerResult): LambdaResult {
  const { status, ...response } = result;

  if ("data" in response) {
    const { data } = response;

    return {
      statusCode: status,
      body: data != null ? JSON.stringify(data) : "",
      headers: { "Content-Type": "application/json" },
    };
  }

  if ("error" in response) {
    const { error } = response;

    return {
      statusCode: status,
      body:
        error != null
          ? JSON.stringify({ ...toErrorResponseBody(status, error), error })
          : "",
      headers: { "Content-Type": "application/json" },
    };
  }

  return {
    statusCode: status,
    body: "",
  };
}

interface ValidateHandlerResponseOptions {
  showErrors?: boolean;
}

interface ValidationResult {
  readonly result: HandlerResult;
  readonly errors?: unknown[];
}

export function validateHandlerResponse(
  result: HandlerResult,
  schema?: ZodType,
  options?: ValidateHandlerResponseOptions,
): ValidationResult {
  if (!schema || !("data" in result) || result.data === undefined) {
    return { result };
  }

  const { success, error } = schema.safeParse(result.data);

  if (!success) {
    return {
      result: {
        status: 500,
        error: options?.showErrors
          ? {
              message: "Failed handler response validation",
              errors: zodIssuesToErrorDetails(error.issues),
            }
          : "Internal server error",
      },
      errors: error.issues,
    };
  }

  return { result };
}
