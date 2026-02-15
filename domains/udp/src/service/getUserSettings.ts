import { getLogger } from "@flex/logging";
import { createSigv4Fetch } from "@flex/utils";
import { parseResponseBodyTyped } from "@flex/utils";
import createHttpError from "http-errors";
import status from "http-status";

import { SERVICE_NAME } from "../constants";
import {
  buildPrivateGatewayUrl,
  UDP_GATEWAY_BASE,
  UDP_ROUTES,
} from "../routes";
import { consentResponseSchema } from "../schemas";

interface GetUserSettingsOptions {
  region: string;
  baseUrl: URL;
  pairwiseId: string;
}

/**
 * Gets the user settings from the private gateway
 *
 * @param {GetUserSettingsOptions} options - The options for getting the user settings
 * @returns {Promise<UserSettings>} The user settings
 */
export const getUserSettings = async ({
  region,
  baseUrl,
  pairwiseId,
}: GetUserSettingsOptions) => {
  const logger = getLogger();
  const udpFetch = createSigv4Fetch({
    region,
    baseUrl: buildPrivateGatewayUrl(baseUrl, UDP_GATEWAY_BASE),
    headers: {
      "requesting-service": SERVICE_NAME,
      "requesting-service-user-id": pairwiseId,
    },
  });

  logger.info("Getting user settings");
  const notificationsResponse = await parseResponseBodyTyped(
    await udpFetch({
      method: "GET",
      path: UDP_ROUTES.notifications,
    }),
    consentResponseSchema,
  );

  logger.info("Notifications response", {
    status: notificationsResponse.response.status,
    statusText: notificationsResponse.response.statusText,
  });

  if (
    !notificationsResponse.response.ok ||
    notificationsResponse.response.status !== status.OK
  ) {
    if (notificationsResponse.response.status === status.NOT_FOUND) {
      logger.debug("User settings not found");
      return null;
    }
    logger.error("Failed to get user settings", {
      status: notificationsResponse.response.status,
      statusText: notificationsResponse.response.statusText,
    });
    throw new createHttpError.BadGateway();
  }

  const analyticsResponse = await parseResponseBodyTyped(
    await udpFetch({
      method: "GET",
      path: UDP_ROUTES.analytics,
    }),
    consentResponseSchema,
  );

  if (
    !analyticsResponse.response.ok ||
    analyticsResponse.response.status !== status.OK
  ) {
    if (analyticsResponse.response.status === status.NOT_FOUND) {
      logger.debug("Analytics settings not found");
      return null;
    }
    logger.error("Failed to get user settings", {
      status: analyticsResponse.response.status,
      statusText: analyticsResponse.response.statusText,
    });
    throw new createHttpError.BadGateway();
  }

  return {
    notifications: notificationsResponse.data,
    analytics: analyticsResponse.data,
  };
};
