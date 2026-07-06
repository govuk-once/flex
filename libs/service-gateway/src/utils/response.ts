import { logger } from "@flex/logging";
import {
  HeaderValidationError,
  isClientError,
  isServerError,
  jsonResponse,
  QueryParametersParseError,
  RequestBodyParseError,
} from "@flex/utils";
import type { APIGatewayProxyResultV2 } from "aws-lambda";
import createHttpError from "http-errors";

export function toDownstreamErrorResponse(
  name: string,
  error: { status: number; message: string; body?: unknown },
): APIGatewayProxyResultV2 {
  logger.debug("Mapping remote error to gateway response", { error });

  const { message, status, body } = error;

  if (isServerError(status)) {
    const errorMessage = `${name} upstream service unavailable`;

    logger.debug(errorMessage, { error });

    return jsonResponse(502, { message: errorMessage });
  }

  return jsonResponse(status, {
    message,
    ...(isClientError(status) && body !== undefined ? { error: body } : {}),
  });
}

export function toGatewayErrorResponse(
  error: unknown,
): APIGatewayProxyResultV2 {
  if (error instanceof HeaderValidationError) {
    const { headers, message, statusCode } = error;

    logger.warn("Missing required headers", { headers });

    return jsonResponse(statusCode, { message, headers });
  }

  if (error instanceof QueryParametersParseError) {
    const { errors, message, statusCode } = error;

    logger.warn("Invalid query parameters", { errors });

    return jsonResponse(statusCode, { message, errors });
  }

  if (error instanceof RequestBodyParseError) {
    const { message, statusCode } = error;

    logger.warn("Invalid request body", { message });

    return jsonResponse(statusCode, { message });
  }

  if (createHttpError.isHttpError(error)) {
    const { message, statusCode } = error;

    const logLevel = isServerError(statusCode) ? "error" : "warn";

    logger[logLevel](message, { statusCode });

    return jsonResponse(statusCode, { message });
  }

  logger.error("Internal server error", { error });

  return jsonResponse(500, { message: "Internal server error" });
}
