import { route } from "@domain";
import createHttpError from "http-errors";

export const handler = route(
  "GET /v1/activity/searches",
  async ({ auth, integrations, logger }) => {
    const result = await integrations.udpGetSearches({
      headers: { "requesting-service-user-id": auth.pairwiseId },
    });

    if (!result.ok) {
      logger.error("Upstream request failed", { status: result.error.status });
      throw new createHttpError.BadGateway();
    }

    return { status: 200, data: result.data };
  },
);
