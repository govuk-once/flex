import { logger } from "@flex/logging";
import { emitTelemetry, TelemetryEvent } from "@flex/telemetry";
import {
  buildErrorResponse,
  headersToErrorDetails,
  HeaderValidationError,
  isServerError,
  jsonResponse,
  QueryParametersParseError,
  RequestBodyParseError,
  toErrorResponseBody,
} from "@flex/utils";
import type { APIGatewayProxyResultV2 } from "aws-lambda";
import createHttpError from "http-errors";

// TODO: Fix non-client error path to fallback to gateway errors
export function toDownstreamErrorResponse(
  name: string,
  error: { status: number; message: string; body?: unknown },
): APIGatewayProxyResultV2 {
  logger.debug("Mapping remote error to gateway response", { error });

  const { message, status, body } = error;

  if (isServerError(status)) {
    const errorMessage = `${name} upstream service unavailable`;

    logger.debug(errorMessage, { error });
    emitTelemetry(TelemetryEvent.service_gateway_error_returned, {
      status: 502,
      upstreamStatus: status,
    });

    return jsonResponse(502, buildErrorResponse("server_error", errorMessage));
  }

  emitTelemetry(TelemetryEvent.service_gateway_error_returned, { status });

  const extras = body && typeof body === "object" ? body : {};
  const flat = toErrorResponseBody(status, { ...extras, message });

  return jsonResponse(
    status,
    body !== undefined ? { ...flat, error: body } : flat,
  );
}

export function toGatewayErrorResponse(
  error: unknown,
): APIGatewayProxyResultV2 {
  const emitGatewayError = (status: number) => {
    emitTelemetry(TelemetryEvent.service_gateway_error_returned, { status });
  };

  if (error instanceof HeaderValidationError) {
    const { headers, message, statusCode } = error;

    logger.warn("Missing required headers", { headers });
    emitTelemetry(TelemetryEvent.request_validation_failed, {
      part: "headers",
    });
    emitGatewayError(statusCode);

    return jsonResponse(
      statusCode,
      buildErrorResponse(
        "validation_error",
        message,
        headersToErrorDetails(headers),
      ),
    );
  }

  if (error instanceof QueryParametersParseError) {
    const { errors, message, statusCode } = error;

    logger.warn("Invalid query parameters", { errors });
    emitTelemetry(TelemetryEvent.request_validation_failed, { part: "query" });
    emitGatewayError(statusCode);

    return jsonResponse(
      statusCode,
      buildErrorResponse("validation_error", message, errors),
    );
  }

  if (error instanceof RequestBodyParseError) {
    const { message, statusCode } = error;

    logger.warn("Invalid request body", { message });
    emitTelemetry(TelemetryEvent.request_validation_failed, { part: "body" });
    emitGatewayError(statusCode);

    return jsonResponse(
      statusCode,
      buildErrorResponse("validation_error", message),
    );
  }

  if (createHttpError.isHttpError(error)) {
    const { expose, message, statusCode } = error;

    const logLevel = isServerError(statusCode) ? "error" : "warn";

    logger[logLevel](message, { statusCode });
    emitGatewayError(statusCode);

    return jsonResponse(
      statusCode,
      buildErrorResponse(
        isServerError(statusCode) ? "server_error" : "client_error",
        expose ? message : "Request failed",
      ),
    );
  }

  logger.error("Internal server error", { error });
  emitTelemetry(TelemetryEvent.error_thrown, {
    ...(error instanceof Error && { reason: error.message }),
  });
  emitGatewayError(500);

  return jsonResponse(
    500,
    buildErrorResponse("server_error", "Internal server error"),
  );
}
