import { getLogger } from "@flex/logging";
import createHttpError from "http-errors";

import { createUdpDomainClient, UdpDomainClient } from "../client";
import { PreferencesResponse } from "../schemas/preferences";

const createUser = async ({
  notificationId,
  appId,
  client,
}: {
  notificationId: string;
  appId: string;
  client: UdpDomainClient;
}) => {
  const logger = getLogger();
  const response = await client.domain.createUser({
    notificationId,
    appId,
  });

  if (!response.ok) {
    logger.error("Failed to create user", {
      response: JSON.stringify(response),
      status: response.error.body,
    });

    throw new createHttpError.BadGateway();
  }

  logger.debug("User created successfully, setting default preferences");

  const updatePreferencesResponse = await client.gateway.updatePreferences(
    {
      preferences: {
        notifications: {
          consentStatus: "unknown",
        },
      },
    },
    appId,
  );

  if (!updatePreferencesResponse.ok) {
    logger.error("Failed to set default preferences", {
      response: JSON.stringify(updatePreferencesResponse),
      status: updatePreferencesResponse.error.body,
    });

    throw new createHttpError.BadGateway();
  }
};

const getNotificationPreferences = async (
  client: UdpDomainClient,
  appId: string,
) => {
  const logger = getLogger();

  const notificationsResponse = await client.gateway.getPreferences(appId);

  if (!notificationsResponse.ok && notificationsResponse.error.status === 404) {
    logger.debug("User settings not found");
    return null;
  }

  if (!notificationsResponse.ok) {
    logger.error("Failed to get user preferences", {
      response: JSON.stringify(notificationsResponse),
      status: notificationsResponse.error.body,
    });

    throw new createHttpError.BadGateway();
  }

  return notificationsResponse.data;
};

const userProfile = ({
  notificationId,
  appId,
  preferences,
}: {
  notificationId: string;
  appId: string;
  preferences: PreferencesResponse["preferences"];
}) => {
  return {
    notificationId,
    appId,
    preferences,
  };
};

export const getUserProfile = async ({
  region,
  baseUrl,
  notificationId,
  appId,
}: {
  region: string;
  baseUrl: string;
  notificationId: string;
  appId: string;
}) => {
  const logger = getLogger();
  const client = createUdpDomainClient({
    region,
    baseUrl,
  });

  const preferencesResponse = await getNotificationPreferences(client, appId);

  if (!preferencesResponse) {
    logger.debug("User settings not found, creating user");
    await createUser({
      notificationId,
      appId,
      client,
    });
    const newPreferencesResponse = await getNotificationPreferences(
      client,
      appId,
    );

    if (!newPreferencesResponse) {
      throw new createHttpError.BadGateway();
    }

    return userProfile({
      notificationId,
      appId,
      preferences: newPreferencesResponse.preferences,
    });
  }

  return userProfile({
    notificationId,
    appId,
    preferences: preferencesResponse.preferences,
  });
};
