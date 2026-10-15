import { route } from "@domain";
import createHttpError from "http-errors";

export const handler = route(
  "PATCH /v1/topics",
  async ({ auth, body, integrations, logger }) => {
    const result = await integrations.udpPostTopics({
      headers: { "requesting-service-user-id": auth.userId },
      body,
    });

    if (!result.ok) {
      const { status } = result.error;

      if (status === 409) {
        logger.error("Update rejected because a newer version already exists", {
          status,
          userId: auth.userId,
        });

        throw new createHttpError.Conflict();
      }

      logger.error("Failed to update user topics", { status });

      throw new createHttpError.BadGateway();
    }

    logger.info("Successfully updated topics", { data: result.data });

    return { status: 204 };
  },
);
