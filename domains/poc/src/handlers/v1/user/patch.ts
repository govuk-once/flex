import { ok } from "@flex/sdk";

import { route } from "../../../../domain.config";

export const handler = route(
  "PATCH /v1/user",
  async ({ auth, body, integrations, logger }) => {
    logger.info("Log from PATCH /v1/user");

    // TODO: Implement, only available through types for now
    const result = await integrations.udpPatchUser({
      body: {
        preferences: {
          notifications: {
            consentStatus: body.preferences.notifications.consentStatus,
          },
        },
      },
      headers: {},
      query: {},
    });

    if (!result.ok) {
      // TODO: Handle error
    }

    // TODO: Temporary workaround to satisfy types
    return ok(200, {
      preferences: {
        notifications: {
          consentStatus: "unknown",
        },
      },
    });
  },
);
