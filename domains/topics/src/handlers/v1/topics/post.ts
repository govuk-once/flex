import { route, routeContext } from "@domain";
import type { UserId } from "@flex/utils";
import createHttpError from "http-errors";

const context = routeContext<"POST /v1/topics">;

export const handler = route("POST /v1/topics", async ({ auth }) => {
  const userId = auth.pairwiseId as UserId;

  await updateTopics(userId);

  return { status: 204 };
});

async function updateTopics(userId: UserId): Promise<void> {
  const { body, integrations, logger } = context();

  const result = await integrations.udpPostTopics({
    headers: { "requesting-service-user-id": userId },
    body,
  });

  if (!result.ok) {
    const { status } = result.error;

    logger.error("Failed to update user topics", { status });
    throw new createHttpError.BadGateway();
  }

  logger.debug("User topics updated successfully");
}
