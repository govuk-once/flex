import { getLogger } from "@flex/logging";
import createHttpError from "http-errors";
import status from "http-status";

import { createUdpDomainClient, UdpDomainClient } from "../../../client";
import { CONSENT_STATUS } from "../../../schemas";
import { UserProfile } from "../types/user";

interface AggregateUserProfileOptions {
  region: string;
  baseUrl: URL;
  pairwiseId: string;
  notificationId: string;
}

const defaultConsentPayload = () => ({
  data: {
    consentStatus: CONSENT_STATUS.UNKNOWN,
    updatedAt: new Date().toISOString(),
  },
});

const createUser = async ({
  notificationId,
  client,
}: {
  notificationId: string;
  client: UdpDomainClient;
}) => {
  const logger = getLogger();
  const response = await client.domain.createUser({
    notificationId,
  });

  if (!response.ok) {
    logger.error("Failed to create user", {
      response: JSON.stringify(response),
      status: response.status,
    });
    throw new createHttpError.BadGateway();
  }

  await client.gateway.postNotifications(defaultConsentPayload());
};

export const getNotificationPreferences = async (client: UdpDomainClient) => {
  const logger = getLogger();

  const notificationsResponse = await client.gateway.getNotifications();

  if (
    notificationsResponse.response.status === status.NOT_FOUND ||
    !notificationsResponse.data
  ) {
    logger.debug("User settings not found");
    return null;
  }

  return {
    notifications: notificationsResponse.data,
  };
};

/**
 * Aggregates the user profile from the user settings and creates a user if they don't exist
 *
 * @param {AggregateUserProfileOptions} param0 - The options for aggregating the user profile
 * @returns {Promise<UserProfile>} The user profile
 */
export const aggregateUserProfile = async ({
  region,
  baseUrl,
  pairwiseId,
  notificationId,
}: AggregateUserProfileOptions): Promise<UserProfile> => {
  const logger = getLogger();
  const client = createUdpDomainClient({ region, baseUrl, pairwiseId });
  const notificationPreferences = await getNotificationPreferences(client);

  if (!notificationPreferences) {
    logger.debug(
      "User not found, creating user and setting default user settings",
    );
    await createUser({
      notificationId,
      client,
    });
    const notificationPreferences = await getNotificationPreferences(client);
    if (!notificationPreferences) {
      throw new createHttpError.BadGateway();
    }
    return {
      notificationId,
      preferences: notificationPreferences,
    };
  }
  return {
    notificationId,
    preferences: notificationPreferences,
  };
};
