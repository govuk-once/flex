import { IntegrationResult } from "@flex/sdk";
import createHttpError, { isHttpError } from "http-errors";
import status from "http-status";

import { routeContext } from "../../domain.config";

type Endpoints =
  | "POST /v1/unlink [private]"
  | "POST /v1/share-code"
  | "POST /v1/test-notification"
  | "GET /v1/vehicle-enquiry/:reg"
  | "POST /v1/share-code/:id/cancel"
  | "GET /v1/customer/licence"
  | "GET /v1/customer/vehicles"
  | "GET /v1/customer/vehicle/:id";

const context = routeContext<Endpoints>;

interface UpstreamErrorBody {
  error?: {
    errors?: Array<{
      code?: string;
      title?: string;
    }>;
  };
}

export function handleStandardErrors(
  response: IntegrationResult,
  route: Endpoints,
): asserts response is {
  readonly ok: true;
  readonly status: number;
  readonly data: unknown;
} {
  const { logger } = context();

  if (!response.ok) {
    const { status: errorStatus, body: errorBody } = response.error;

    logger.error(`Failed response from DVLA ${route}`, {
      status: errorStatus,
      errorBody,
    });

    const typedBody = errorBody as UpstreamErrorBody | undefined;
    const providerErrorCode = typedBody?.error?.errors?.[0]?.code;
    const providerErrorTitle = typedBody?.error?.errors?.[0]?.title;

    switch (errorStatus) {
      case status.BAD_REQUEST:
        throw new createHttpError.BadRequest();

      case status.NOT_FOUND:
        throw createHttpError(status.NOT_FOUND, "Resource not found", {
          code: providerErrorCode,
          message: providerErrorTitle ?? "Not found",
        });

      case status.TOO_MANY_REQUESTS:
        throw new createHttpError.TooManyRequests();

      default:
        throw new createHttpError.BadGateway();
    }
  }
}

/**
 * Common DVLA errors that apply across ALL DVLA endpoints.
 */
const COMMON_DVLA_ERRORS: Record<string, string> = {
  "GUK-404-01": "Linking ID held is no longer valid",
};

export interface DvlaErrorResponse {
  status: number;
  error: {
    code: string;
    message: string;
  };
}

/**
 * Intercepts DVLA HttpErrors and returns a structured error response payload.
 * Handles common global codes automatically (e.g. GUK-404-01) while allowing
 * endpoint-specific code overrides.
 */
export function handleDvlaErrorResponse(
  error: unknown,
  customEndpointMappings: Record<string, string> = {},
): DvlaErrorResponse {
  if (
    isHttpError(error) &&
    error.statusCode === status.NOT_FOUND &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    const errorCode = error.code;
    const allMappings = { ...COMMON_DVLA_ERRORS, ...customEndpointMappings };

    if (errorCode in allMappings) {
      return {
        status: status.NOT_FOUND,
        error: {
          code: errorCode,
          message: allMappings[errorCode] || error.message || "Not Found",
        },
      };
    }
  }

  throw error;
}
