import { route } from "@domain";
import createHttpError from "http-errors";
import { status } from "http-status";

export const handler = route("GET /v1/vehicle-enquiry/:reg", async (ctx) => {
  const response = await ctx.integrations.dvlaVehicleEnquiry({
    path: `/${ctx.pathParams.reg}`,
  });

  if (!response.ok) {
    const { status: errorStatus, body: errorBody } = response.error;

    ctx.logger.error("Failed to get vehicle enquiry with DVLA", {
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

  return {
    status: status.OK,
    data: response.data,
  };
});
