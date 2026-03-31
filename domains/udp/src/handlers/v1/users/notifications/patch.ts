import { route, routeContext } from "@domain";
import type { UserId } from "@flex/utils";
import type {
  PushId,
  UpdateNotificationPreferencesOutboundResponse,
} from "@schemas/notifications";
import { getPushId } from "@utils";
import createHttpError from "http-errors";

const context = routeContext<"PATCH /v1/users/notifications">;

export const handler = route(
  "PATCH /v1/users/notifications",
  async ({ auth, resources }) => {
    // TODO: Add to SDK auth or keep alias for this domain only?
    const userId = auth.pairwiseId as UserId;

    const notifications = await updateNotifications(
      userId,
      getPushId(userId, resources.udpNotificationSecret),
    );

    return { status: 200, data: notifications };
  },
);

async function updateNotifications(
  userId: UserId,
  pushId: PushId,
): Promise<UpdateNotificationPreferencesOutboundResponse> {
  const { body, integrations, logger } = context();

  const result = await integrations.udpCreateNotificationPreferences({
    headers: {
      "requesting-service": "app",
      "requesting-service-user-id": userId,
    },
    body: { consentStatus: body.consentStatus, pushId },
  });

  if (!result.ok) {
    const { status } = result.error;

    logger.error("Failed to update user notification preferences", { status });
    throw new createHttpError.BadGateway();
  }

  logger.debug("User notification preferences updated successfully");

  return result.data;
}
