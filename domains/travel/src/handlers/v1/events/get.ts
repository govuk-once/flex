import { route } from "@domain";
import createHttpError from "http-errors";

export const handler = route(
  "GET /v1/events",
  async ({ integrations, queryParams, logger }) => {
    const result = await integrations.travelGetEvents({
      query: {
        namespace: queryParams.namespace,
        group: queryParams.group,
      },
    });

    if (!result.ok) {
      const { status, body } = result.error;

      logger.error("Failed to get events", { status, body });

      throw new createHttpError.BadGateway();
    }

    logger.info("Successfully fetched events", { data: result.data });

    return { status: 200, data: result.data };
  },
);
