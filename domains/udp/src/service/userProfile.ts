import { getLogger } from "@flex/logging";
import createHttpError from "http-errors";

import { createUdpDomainClient, UdpDomainClient } from "../client";
import { CreateNotificationResponse } from "../schemas/notifications";

const createUser = async ({
  notificationId,
  userId,
  client,
}: {
  notificationId: string;
  userId: string;
  client: UdpDomainClient;
}) => {
  const logger = getLogger();
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
};

const getNotificationPreferences = async (
  client: UdpDomainClient,
  userId: string,
) => {
  const logger = getLogger();

  const notificationsResponse = await client.gateway.notifications.get(userId);

  if (!notificationsResponse.ok && notificationsResponse.error.status === 404) {
    logger.debug("No notifications settings exist for this user.");
    return null;
  }

  if (!notificationsResponse.ok) {
    logger.error("Failed to retrieve notifications settings", {
      status: notificationsResponse.error.status,
    });

    throw new createHttpError.BadGateway();
  }

  return notificationsResponse.data;
};

const userProfile = ({
  notificationId,
  userId,
  notifications,
}: {
  notificationId: string;
  userId: string;
  notifications: CreateNotificationResponse;
}) => {
  return {
    notificationId,
    userId,
    notifications,
  };
};

export const getUserProfile = async ({
  region,
  baseUrl,
  notificationId,
  userId,
}: {
  region: string;
  baseUrl: string;
  notificationId: string;
  userId: string;
}) => {
  const logger = getLogger();
  const client = createUdpDomainClient({
    region,
    baseUrl,
  });

  let notificationsResponse = await getNotificationPreferences(client, userId);

  if (!notificationsResponse) {
    logger.debug("User settings not found, creating user");
    await createUser({
      notificationId,
      userId,
      client,
    });
    notificationsResponse = await getNotificationPreferences(client, userId);

    if (!notificationsResponse) {
      throw new createHttpError.BadGateway();
    }
  }

  return userProfile({
    notificationId,
    userId,
    notifications: notificationsResponse,
  });
};
