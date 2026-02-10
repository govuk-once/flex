import crypto from "node:crypto";

import { ok } from "@flex/sdk";

import { route } from "../../../../domain.config";

export const handler = route(
  "GET /v1/user",
  async ({ auth, integrations, logger, resources }) => {
    logger.info("Log from GET /v1/user");

    // TODO: Implement, only available through types for now
    const result = await integrations.udpRead({
      path: "/example",
      headers: {},
      query: {},
    });

    if (!result.ok) {
      // TODO: Handle error
    }

    const notificationId = crypto
      .createHmac("sha256", resources.flexUdpNotificationSecret)
      .update(auth.pairwiseId)
      .digest("base64url");

    // TODO: Temporary workaround to satisfy types
    return ok(200, {
      appId: "app-id",
      notificationId,
      preferences: {
        notifications: {
          consentStatus: "unknown",
        },
      },
    });
  },
);
