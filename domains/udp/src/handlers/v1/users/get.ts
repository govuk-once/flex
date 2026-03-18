import { route, routeContext } from "@domain";
import { UserId } from "@flex/utils";
import type {
  GetNotificationPreferencesResponse,
  NotificationId,
  UpdateNotificationPreferencesOutboundResponse,
} from "@schemas/notifications";
import { getNotificationId } from "@utils/get-notification-id";
import createHttpError from "http-errors";

const context = routeContext<"GET /v1/users">;

export const handler = route("GET /v1/users", async ({ auth, resources }) => {
  // TODO: Add to SDK auth or keep alias for this domain only?
  const userId = auth.pairwiseId as UserId;

  const notificationId = getNotificationId(
    userId,
    resources.udpNotificationSecret,
  );

  const notifications = await getNotifications(userId);

  if (notifications) {
    return {
      status: 200,
      data: { notificationId, notifications, userId },
    };
  }

  await createUser(userId, notificationId);

  const created = await createNotifications(userId, notificationId);

  return {
    status: 200,
    data: { userId, notificationId, notifications: created },
  };
});

async function getNotifications(
  userId: UserId,
): Promise<GetNotificationPreferencesResponse | null> {
  const { integrations, logger } = context();

  const result = await integrations.udpGetNotificationPreferences({
    headers: {
      "requesting-service": "app",
      "requesting-service-user-id": userId,
    },
  });

  if (!result.ok) {
    const { status } = result.error;

    if (status === 404) return null;

    logger.error("Failed to get user notification preferences", { status });
    throw new createHttpError.BadGateway();
  }

  logger.debug("Found existing user notification preferences");

  return result.data;
}

async function createUser(userId: UserId, notificationId: NotificationId) {
  const { integrations, logger } = context();

  const result = await integrations.createUser({
    body: { userId, notificationId },
  });

  if (!result.ok) {
    logger.error("Failed to create user", { status: result.error.status });
    throw new createHttpError.BadGateway();
  }

  logger.debug("User created successfully");
}

async function createNotifications(
  userId: UserId,
  notificationId: NotificationId,
): Promise<UpdateNotificationPreferencesOutboundResponse> {
  const { integrations, logger } = context();

  const result = await integrations.udpCreateNotificationPreferences({
    headers: {
      "requesting-service": "app",
      "requesting-service-user-id": userId,
    },
    body: { consentStatus: "unknown", notificationId },
  });

  if (!result.ok) {
    logger.error("Failed to create user notification preferences", {
      status: result.error.status,
    });
    throw new createHttpError.BadGateway();
  }

  logger.debug("User notification preferences created successfully");

  return result.data;
}
