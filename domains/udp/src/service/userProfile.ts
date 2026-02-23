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

  await client.gateway.updatePreferences({
    notifications: {
      consentStatus: "unknown",
    },
  });
};

const getNotificationPreferences = async (client: UdpDomainClient) => {
  const logger = getLogger();

  const notificationsResponse = await client.gateway.getPreferences();

  if (!notificationsResponse.ok) {
    logger.debug("User settings not found");
    return null;
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

  const preferencesResponse = await getNotificationPreferences(client);

  if (!preferencesResponse) {
    logger.debug("User settings not found");
    await createUser({
      notificationId,
      appId,
      client,
    });
    const newPreferencesResponse = await getNotificationPreferences(client);

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
