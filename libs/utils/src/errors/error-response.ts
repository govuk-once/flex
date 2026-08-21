import { z, type ZodError } from "zod";

export const ErrorTypeSchema = z.enum([
  "auth_error",
  "validation_error",
  "client_error",
  "server_error",
]);

export type ErrorType = z.infer<typeof ErrorTypeSchema>;

export const ErrorDetailSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

export const ErrorResponseSchema = z.object({
  message: z.string(),
  type: ErrorTypeSchema,
  errors: z.array(ErrorDetailSchema).optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export function buildErrorResponse(
  type: ErrorType,
  message: string,
  errors?: readonly ErrorDetail[],
): ErrorResponse {
  return {
    message,
    type,
    ...(errors && errors.length > 0 ? { errors: [...errors] } : {}),
  };
}

export function headersToErrorDetails(
  headers: readonly string[],
): ErrorDetail[] {
  return headers.map((field) => ({
    field,
    message: "Required header missing",
  }));
}

export function zodIssuesToErrorDetails(
  issues: ZodError["issues"],
): ErrorDetail[] {
  return issues.map(({ message, path }) => ({
    field: path.join("."),
    message,
  }));
}

export function errorTypeForStatus(status: number): ErrorType {
  if (status === 401 || status === 403) return "auth_error";
  if (status >= 500) return "server_error";
  return "client_error";
}

function defaultErrorMessage(status: number): string {
  if (status >= 500) return "Internal server error";
  if (status === 401 || status === 403) return "Unauthorized";
  return "Request failed";
}

export function toErrorResponseBody(
  status: number,
  error?: unknown,
): ErrorResponse & Record<string, unknown> {
  const type = errorTypeForStatus(status);

  if (typeof error === "string") {
    return buildErrorResponse(type, error);
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const { message, errors } = record;
    const extras = Object.fromEntries(
      Object.entries(record).filter(
        ([key]) => key !== "message" && key !== "type" && key !== "errors",
      ),
    );

    return {
      ...extras,
      ...buildErrorResponse(
        type,
        typeof message === "string" ? message : defaultErrorMessage(status),
        Array.isArray(errors) ? (errors as ErrorDetail[]) : undefined,
      ),
    };
  }

  return buildErrorResponse(type, defaultErrorMessage(status));
}
