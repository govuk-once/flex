import { route, routeContext } from "@domain";
import { UserId } from "@flex/utils";
import type {
  GetNotificationPreferencesResponse,
  PushId,
  UpdateNotificationPreferencesOutboundResponse,
} from "@schemas/notifications";
import { getPushId } from "@utils/get-push-id";
import createHttpError from "http-errors";

const context = routeContext<"GET /v1/users">;

export const handler = route("GET /v1/users", async ({ auth, resources }) => {
  const { logger } = context();
  // TODO: Add to SDK auth or keep alias for this domain only?
  const userId = auth.pairwiseId as UserId;

  const pushId = getPushId(userId, resources.udpNotificationSecret);

  const notifications = await getNotifications(userId);

  if (notifications) {
    return {
      status: 200,
      data: { notifications, userId },
    };
  }

  logger.info("No user found creating user");

  await createUser(userId, pushId);

  const created = await createNotifications(userId, pushId);

  return {
    status: 200,
    data: { userId, notifications: created },
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

async function createUser(userId: UserId, pushId: PushId) {
  const { integrations, logger } = context();

  const result = await integrations.createUser({
    body: { userId, pushId },
  });

  if (!result.ok) {
    logger.error("Failed to create user", { status: result.error.status });
    throw new createHttpError.BadGateway();
  }

  logger.debug("User created successfully");
}

async function createNotifications(
  userId: UserId,
  pushId: PushId,
): Promise<UpdateNotificationPreferencesOutboundResponse> {
  const { integrations, logger } = context();

  const result = await integrations.udpCreateNotificationPreferences({
    headers: {
      "requesting-service": "app",
      "requesting-service-user-id": userId,
    },
    body: { consentStatus: "unknown", pushId },
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
