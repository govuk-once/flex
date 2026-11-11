import type { IntegrationResult } from "@flex/sdk";
import createHttpError from "http-errors";
import { status } from "http-status";

import { routeContext } from "../../domain.config";

type Endpoints = "GET /v1/vehicle/mot/:reg";

const context = routeContext<Endpoints>;

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

    logger.error(`Failed response from DVSA ${route}`, {
      status: errorStatus,
      errorBody,
    });

    switch (errorStatus) {
      case status.BAD_REQUEST:
        throw new createHttpError.BadRequest();

      case status.NOT_FOUND:
        throw new createHttpError.NotFound();

      case status.TOO_MANY_REQUESTS:
        throw new createHttpError.TooManyRequests();

      default:
        throw new createHttpError.BadGateway();
    }
  }
}
