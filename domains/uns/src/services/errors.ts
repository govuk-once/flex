import createHttpError from "http-errors";
import httpStatus from "http-status";

// TODO: Fixes sonar "duplicate code" issue until FLEX-249 is implemented
export function throwIntegrationError(status: number): never {
  switch (status) {
    case httpStatus.BAD_REQUEST:
      throw new createHttpError.BadRequest();
    case httpStatus.NOT_FOUND:
      throw new createHttpError.NotFound();
    case httpStatus.TOO_MANY_REQUESTS:
      throw new createHttpError.TooManyRequests();
    default:
      throw new createHttpError.BadGateway();
  }
}
