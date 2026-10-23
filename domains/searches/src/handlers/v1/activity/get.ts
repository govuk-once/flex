import { route } from "@domain";
import createHttpError from "http-errors";
import {GetSelectedSearchesResponse} from "@schemas/search";
import type {UserId} from "@flex/utils";

export const handler = route(
  "GET /v1/activity/searches",
  async ({ auth, integrations, logger }) => {
    const userId = auth.pairwiseId as UserId;

    const result = await integrations.udpGetSearches({
      headers: { "requesting-service-user-id": userId },
    });

    if (!result.ok) {
        const { status } = result.error;

        if (status === 404) {
            logger.info("User not found", { status, userId });

            const emptySearches: GetSelectedSearchesResponse = {
                searches: {
                    selectedSearches: [],
                },
            };

            logger.info("Returning empty searches", { data: emptySearches });

            return {
                status: 200,
                data: emptySearches,
            };
        }

        logger.error("Failed to get user searches", { status });

        throw new createHttpError.BadGateway();
    }

    logger.info("Successfully fetched searches", { data: result.data });

    return { status: 200, data: result.data };
  },
);
