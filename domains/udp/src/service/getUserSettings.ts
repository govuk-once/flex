import { getLogger } from "@flex/logging";
import { createSigv4Fetch } from "@flex/utils";
import createHttpError from "http-errors";
import status from "http-status";
import { parseJsonResponse, consentResponseSchema } from "../schemas";

import { SERVICE_NAME } from "../constants";
import {
  buildPrivateGatewayUrl,
  UDP_GATEWAY_BASE,
  UDP_ROUTES,
} from "../routes";

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
  const notificationsResponse = await udpFetch({
    method: "GET",
    path: UDP_ROUTES.notifications,
  });

  logger.info("Notifications response", {
    status: notificationsResponse.status,
    statusText: notificationsResponse.statusText,
  });

  if (!notificationsResponse.ok || notificationsResponse.status !== status.OK) {
    if (notificationsResponse.status === status.NOT_FOUND) {
      logger.debug("User settings not found");
      return null;
    }
    logger.error("Failed to get user settings", {
      status: notificationsResponse.status,
      statusText: notificationsResponse.statusText,
    });
    throw new createHttpError.BadGateway();
  }

  const analyticsResponse = await udpFetch({
    method: "GET",
    path: UDP_ROUTES.analytics,
  });

  if (!analyticsResponse.ok || analyticsResponse.status !== status.OK) {
    if (analyticsResponse.status === status.NOT_FOUND) {
      logger.debug("Analytics settings not found");
      return null;
    }
    logger.error("Failed to get user settings", {
      status: analyticsResponse.status,
      statusText: analyticsResponse.statusText,
    });
    throw new createHttpError.BadGateway();
  }
  // In getUserSettings:
const notificationsData = await parseJsonResponse(
  notificationsResponse,
  consentResponseSchema,
);
const analyticsData = await parseJsonResponse(
  analyticsResponse,
  consentResponseSchema,
);

return {
  notifications: "data" in notificationsData ? notificationsData.data : notificationsData,
  analytics: "data" in analyticsData ? analyticsData.data : analyticsData,
};
};
