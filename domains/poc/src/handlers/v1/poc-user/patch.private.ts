import type { PreferencesRequest, PreferencesResponse } from "@flex/udp-domain";
import createHttpError from "http-errors";

import { route } from "../../../../domain.config";

export const handler = route(
  "PATCH /v1/poc-user [private]",
  async ({ body, headers, integrations, logger }) => {
    const updatePreferencesResult = await integrations.udpWrite<
      PreferencesRequest,
      PreferencesResponse
    >({
      path: "/notifications",
      headers: {
        "requesting-service-user-id": headers.requestingServiceUserId,
      },
      body,
    });

    if (!updatePreferencesResult.ok) {
      logger.error("Failed to update user preferences", {
        response: JSON.stringify(updatePreferencesResult),
        status: updatePreferencesResult.error.status,
        body: updatePreferencesResult.error.body,
      });

      throw new createHttpError.BadGateway();
    }

    return {
      status: 200,
      data: updatePreferencesResult.data,
    };
  },
);
