import { route } from "@domain";
import createHttpError from "http-errors";

export const handler = route(
  "POST /v1/activity/pages",
  async ({ auth, body, integrations, logger }) => {
    const result = await integrations.udpAddVisitedPage({
      headers: { "requesting-service-user-id": auth.userId },
      body,
    });

    if (!result.ok) {
      logger.error("Failed to add visited page", {
        status: result.error.status,
      });
      throw new createHttpError.BadGateway();
    }

    return { status: 204 };
  },
);
