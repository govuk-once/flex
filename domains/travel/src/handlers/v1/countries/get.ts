import { route } from "@domain";
import createHttpError from "http-errors";

export const handler = route(
  "GET /v1/countries",
  async ({ integrations, logger }) => {
    const result = await integrations.travelGetCountries({});

    if (!result.ok) {
      const { status, body } = result.error;

      logger.error("Failed to get countries", { status, body });

      throw new createHttpError.BadGateway();
    }

    return { status: 200, data: result.data };
  },
);
