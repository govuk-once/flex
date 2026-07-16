import { IntegrationResult } from "@flex/sdk";
import createHttpError from "http-errors";
import status from "http-status";

import { routeContext } from "../../domain.config";

type Endpoints =
  | "POST /v1/unlink/:id [private]"
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
