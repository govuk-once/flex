import { route } from "@domain";
import createHttpError from "http-errors";
import { status } from "http-status";

export const handler = route("GET /v1/vehicle-enquiry", async (ctx) => {
  const response = await ctx.integrations.dvlaVehicleEnquiry({
    headers: { registrationNumber: ctx.headers.registrationNumber },
  });

  if (!response.ok) {
    const { status: errorStatus, body: errorBody } = response.error;

    ctx.logger.error("Failed to get driver summary with DVLA", {
      status: errorStatus,
      errorBody,
    });

    switch (errorStatus) {
      case 400:
        throw new createHttpError.BadRequest("Invalid request sent to DVLA.");
      case 404:
        throw new createHttpError.NotFound(
          "Vehicle not found in DVLA records.",
        );
      case 429:
        throw new createHttpError.TooManyRequests(
          "DVLA rate limit exceeded. Please try again later.",
        );
      default:
        throw new createHttpError.BadGateway("Upstream provider error.");
    }
  }

  return {
    status: status.OK,
    data: response.data,
  };
});
