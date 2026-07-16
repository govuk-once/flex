import { route } from "@domain";
import createHttpError from "http-errors";
import status from "http-status";

export const handler = route(
  "GET /v1/countries",
  async ({ integrations, logger }) => {
    const response = await integrations.travelGetCountries({});

    if (!response.ok) {
      logger.error("Failed to get countries from travel gateway", {
        status: response.error.status,
        message: response.error.message,
      });
      throw new createHttpError.BadGateway();
    }

    return {
      status: status.OK,
      data: response.data,
    };
  },
);
