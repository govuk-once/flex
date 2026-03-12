import { createUdpDomainClient, UdpDomainClient } from "@client";
import { logger } from "@flex/logging";
import { UserId } from "@flex/utils";
import { CreateNotificationResponse } from "@schemas/notifications";
import { NotificationId } from "@types";
import createHttpError from "http-errors";

interface ClientConfig {
  region: string;
  baseUrl: string;
}

interface UserContext {
  notificationId: NotificationId;
  userId: UserId;
}

interface UserProfileContext extends UserContext {
  client: UdpDomainClient;
}

type UserProfile = UserContext & {
  notifications: CreateNotificationResponse;
};

const buildUserProfile = (
  user: UserContext,
  notifications: CreateNotificationResponse,
): UserProfile => ({
  ...user,
  notifications,
});

const createUserAndAggregateProfile = async ({
  notificationId,
  userId,
  client,
}: UserProfileContext) => {
  const response = await client.domain.user.create({
    notificationId,
    userId,
  });

  if (!response.ok) {
    logger.error("Failed to create user", {
      status: response.error.status,
    });
    throw new createHttpError.BadGateway();
  }

  logger.debug("User created successfully, creating notifications");

  const createNotificationsResponse = await client.gateway.notifications.create(
    {
      consentStatus: "unknown",
      notificationId,
    },
    userId,
  );

  if (!createNotificationsResponse.ok) {
    logger.error("Failed to create notifications", {
      status: createNotificationsResponse.error.status,
    });
    throw new createHttpError.BadGateway();
  }

  return buildUserProfile(
    { notificationId, userId },
    createNotificationsResponse.data,
  );
};

const aggregateUserProfile = async (
  ctx: UserProfileContext,
): Promise<UserProfile | null> => {
  const [notificationsResult] = await Promise.all([
    ctx.client.gateway.notifications.get(ctx.userId),
  ]);

  if (!notificationsResult.ok && notificationsResult.error.status === 404) {
    return null;
  }
  if (!notificationsResult.ok) {
    logger.error("Failed to retrieve notifications settings", {
      status: notificationsResult.error.status,
    });
    throw new createHttpError.BadGateway();
  }

  return buildUserProfile(
    { notificationId: ctx.notificationId, userId: ctx.userId },
    notificationsResult.data,
  );
};

export const getUserProfile = async ({
  region,
  baseUrl,
  notificationId,
  userId,
}: ClientConfig & UserContext) => {
  const client = createUdpDomainClient({ region, baseUrl });
  const ctx: UserProfileContext = { notificationId, userId, client };

  return (
    (await aggregateUserProfile(ctx)) ??
    (await createUserAndAggregateProfile(ctx))
  );
};
