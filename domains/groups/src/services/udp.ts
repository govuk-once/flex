import { routeContext } from "@domain";
import type { UserId } from "@flex/utils";
import type { GroupSubscription } from "@schemas/group";
import createHttpError from "http-errors";

type Route = "POST /v1/groups";
const getCtx = routeContext<Route>;

export async function getUserGroups(
  userId: UserId,
): Promise<GroupSubscription[]> {
  const { integrations, logger } = getCtx();

  const result = await integrations.udpGetGroups({
    headers: {
      "requesting-service-user-id": userId,
    },
  });

  if (!result.ok) {
    if (result.error.status === 404) {
      logger.debug("User groups not found", { userId });
      return [];
    }

    logger.error("Failed to fetch user groups from UDP", {
      userId,
      error: result.error,
    });

    throw new createHttpError.BadGateway();
  }

  return result.data;
}
