import { route } from "@domain";
import createHttpError from "http-errors";

export const handler = route(
  "GET /v1/greeting",
  async ({ auth, integrations, logger }) => {
    const result = await integrations.udpGetTopics({
      headers: { "requesting-service-user-id": auth.userId },
    });

    if (!result.ok) {
      const { status } = result.error;

      // A user with no topics yet is not an error
      if (status === 404) {
        return { status: 200, data: { message: "Hello", topicCount: 0 } };
      }

      logger.error("Upstream request failed", { status });
      throw new createHttpError.BadGateway();
    }

    logger.info("Greeting user", { userId: auth.userId });
    return {
      status: 200,
      data: {
        message: "Hello",
        topicCount: result.data.topics.selectedTopics.length,
      },
    };
  },
);
