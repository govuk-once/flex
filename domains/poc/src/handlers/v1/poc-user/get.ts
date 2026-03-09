import crypto from "node:crypto";

import type {
  CreateNotificationRequest,
  CreateNotificationResponse,
  CreateUserRequest,
  CreateUserResponse,
  NotificationId,
} from "@flex/udp-domain";
import createHttpError from "http-errors";

import { getUserContext, route } from "../../../../domain.config";

export const handler = route("GET /v1/poc-user", async ({ auth, logger }) => {
  const notificationId = generateDerivedId();

  let preferencesResult = await getUserPreferences();

  if (!preferencesResult.ok) {
    if (preferencesResult.error.status !== 404) {
      logger.error("Failed to get user preferences", {
        response: JSON.stringify(preferencesResult),
        status: preferencesResult.error.status,
        body: preferencesResult.error.body,
      });

      throw new createHttpError.BadGateway();
    }

    logger.debug("User settings not found, creating user");

    const createUserResult = await createUser(notificationId);

    if (!createUserResult.ok) {
      logger.error("Failed to create user", {
        response: JSON.stringify(createUserResult),
        status: createUserResult.error.status,
        body: createUserResult.error.body,
      });

      throw new createHttpError.BadGateway();
    }

    logger.debug("User created successfully, setting default preferences");

    const defaultPreferencesResult =
      await updateUserPreferences(notificationId);

    if (!defaultPreferencesResult.ok) {
      logger.error("Failed to set default preferences", {
        response: JSON.stringify(defaultPreferencesResult),
        status: defaultPreferencesResult.error.status,
        body: defaultPreferencesResult.error.body,
      });

      throw new createHttpError.BadGateway();
    }

    preferencesResult = await getUserPreferences();

    if (!preferencesResult.ok) {
      logger.error("Failed to get user preferences after creating user", {
        response: JSON.stringify(preferencesResult),
        status: preferencesResult.error.status,
        body: preferencesResult.error.body,
      });

      throw new createHttpError.BadGateway();
    }
  }

  return {
    status: 200,
    data: {
      appId: auth.userId,
      notificationId,
      preferences: preferencesResult.data,
    },
  };
});

// ----------------------------------------------------------------------------
// Example: Accessing context outside of route handler via routeContext helpers
// ----------------------------------------------------------------------------

function generateDerivedId() {
  const { auth, resources } = getUserContext();

  return crypto
    .createHmac("sha256", resources.flexUdpNotificationSecret)
    .update(auth.userId)
    .digest("base64url") as NotificationId;
}

async function getUserPreferences() {
  const { auth, integrations } = getUserContext();

  return await integrations.udpRead<CreateNotificationResponse>({
    path: "/notifications",
    headers: { "requesting-service-user-id": auth.userId },
  });
}

async function updateUserPreferences(notificationId: NotificationId) {
  const { auth, integrations } = getUserContext();

  return await integrations.udpWrite<
    CreateNotificationRequest,
    CreateNotificationResponse
  >({
    path: "/notifications",
    headers: { "requesting-service-user-id": auth.userId },
    body: { consentStatus: "unknown", notificationId },
  });
}

async function createUser(notificationId: NotificationId) {
  const { auth, integrations } = getUserContext();

  return await integrations.udpWrite<CreateUserRequest, CreateUserResponse>({
    path: "/user",
    body: { userId: auth.userId, notificationId },
  });
}
