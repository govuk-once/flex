import { route } from "@domain";
import createHttpError from "http-errors";

export const handler = route(
  "GET /v1/topics",
  async ({ auth, integrations, logger }) => {
    const result = await integrations.udpGetTopics({
      headers: { "requesting-service-user-id": auth.userId },
    });

    if (!result.ok) {
      const { status } = result.error;

      if (status === 404) {
        logger.info("User not found, returning empty topics", {
          status,
          userId: auth.userId,
        });

        return {
          status: 200,
          data: { topics: { selectedTopics: [] } },
        };
      }

      logger.error("Failed to get user topics", { status });

      throw new createHttpError.BadGateway();
    }

    logger.info("Successfully fetched topics", { data: result });

    return {
      status: 200,
      data: result.data,
    };
  },
);
