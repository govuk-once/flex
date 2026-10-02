import { route, routeContext } from "@domain";
import { UserId } from "@flex/utils";
import { GetSelectedTopicsResponse } from "@schemas/topic";
import createHttpError from "http-errors";

const context = routeContext<"GET /v1/topics">;

export const handler = route("GET /v1/topics", async ({ auth }) => {
  const userId = UserId.parse(auth.pairwiseId);

  const topics = await getTopics(userId);

  return {
    status: 200,
    data: topics,
  };
});

async function getTopics(userId: UserId): Promise<GetSelectedTopicsResponse> {
  const { integrations, logger } = context();

  const result = await integrations.udpGetTopics({
    headers: { "requesting-service-user-id": userId },
  });

  if (!result.ok) {
    const { status } = result.error;

    if (status === 404) {
      logger.info("User not found", { status, userId });

      const emptyTopics: GetSelectedTopicsResponse = {
        topics: {
          selectedTopics: [],
        },
      };

      logger.info("Returning empty topics", { data: emptyTopics });

      return emptyTopics;
    }

    logger.error("Failed to get user topics", { status });

    throw new createHttpError.BadGateway();
  }

  logger.info("Successfully fetched topics", { data: result.data });

  return result.data;
}
