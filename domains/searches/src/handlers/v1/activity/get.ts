import { route } from "@domain";
import createHttpError from "http-errors";
import { UserSearches } from "@schemas/search";
import type { UserId } from "@flex/utils";
import type { Logger } from "@flex/logging";

export const handler = route(
  "GET /v1/activity/searches",
  async ({ auth, integrations, logger }) => {
    const userId = auth.pairwiseId as UserId;

    const searches: UserSearches = await getSearches(integrations, logger, userId);
    return { status: 200, data: searches };
  },
);

export async function getSearches(integrations: any, logger: Logger, userId: any): Promise<UserSearches> {
    logger.info("GET calling platform")
    let result;
    try {
        result = await integrations.udpGetSearches({
            headers: {"requesting-service-user-id": userId},
        });
        logger.info("GET called platform; got: " + JSON.stringify(result))
    } catch (e) {
        logger.info("Error", { e });
        return {
            searches: []
        };
    }

    if (!result.ok) {
        const { status } = result.error;

        if (status === 404) {
            logger.info("User not found", { status, userId });

            const emptySearches: UserSearches = {
                searches: []
            };

            logger.info("Returning empty searches", { data: emptySearches });

            return emptySearches;
        }

        logger.error("Failed to get user searches", { status });

        throw new createHttpError.BadGateway();
    }

    logger.info("Successfully fetched searches", { data: result.data });

    return result.data;
}
