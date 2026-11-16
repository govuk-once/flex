import { route } from "@domain";
import createHttpError from "http-errors";

export const handler = route(
  "GET /v1/activity/searches",
  async ({ auth, integrations, logger }) => {
    const result = await integrations.udpGetSearches({
      headers: { "requesting-service-user-id": auth.userId },
    });

    if (!result.ok) {
      const { status } = result.error;

      if (status === 404) {
        logger.info("User not found, returning empty searches", {
          status,
          userId: auth.userId,
        });

        return {
          status: 200,
          data: { searches: { selectedSearches: [] } },
        };
      }

      logger.error("Failed to get user searches", { status });

      throw new createHttpError.BadGateway(result.error.message);
    }

    logger.info("Successfully fetched searches", { data: result });

    return {
      status: 200,
      data: result.data,
    };
  },
);
