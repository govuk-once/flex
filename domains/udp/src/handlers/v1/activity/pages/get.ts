import { route } from "@domain";
import createHttpError from "http-errors";
import status from "http-status";

export const handler = route(
  "GET /v1/activity/pages",
  async ({ auth, integrations, logger }) => {
    const result = await integrations.udpGetVisitedPages({
      headers: { "requesting-service-user-id": auth.userId },
    });

    if (!result.ok) {
      logger.error("Failed to get visited pages", {
        status: result.error.status,
      });
      throw new createHttpError.BadGateway();
    }

    return { status: status.OK, data: result.data };
  },
);
