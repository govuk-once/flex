import { route } from "@domain";
import type { UserId } from "@flex/utils";
import { TopicsResponse } from "@schemas/topic";
import createHttpError from "http-errors";

export const handler = route(
  "GET /v1/topics",
  async ({ auth, integrations, logger }) => {
    const userId = auth.pairwiseId as UserId;

    const result = await integrations.udpGetTopics({
      headers: { "requesting-service-user-id": userId },
    });

    if (!result.ok) {
      const { status } = result.error;

      if (status === 404) {
        logger.error("User not found", { status, userId });

        const emptyTopics: TopicsResponse = {
          topics: {
            selectedTopics: [],
          },
        };

        logger.info("Returning empty topics", { data: emptyTopics });

        return {
          status: 200,
          data: emptyTopics,
        };
      }

      logger.error("Failed to get user topics", { status });

      throw new createHttpError.BadGateway();
    }

    logger.info("Successfully fetched topics", { data: result.data });

    return {
      status: 200,
      data: result.data,
    };
  },
);
