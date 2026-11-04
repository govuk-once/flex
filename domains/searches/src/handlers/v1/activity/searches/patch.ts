import { route } from "@domain";
import { SearchTerm, UserSearches } from "@schemas/search";
import createHttpError from "http-errors";

const MAX_SEARCH_TERM_LENGTH = 100;
const MAX_SEARCH_TERMS = 10;

export const handler = route(
    "PATCH /v1/activity/searches",
    async ({ auth, body, integrations, logger }) => {
        const result = await integrations.udpGetSearches({
            headers: { "requesting-service-user-id": auth.userId },
        });

        if (!result.ok) {
            const { status } = result.error;

            if (status === 404) {
                logger.info("User not found, not saving search", {
                    status,
                    userId: auth.userId,
                });

                return {
                    status: 200,
                    data: {},
                };
            }

            logger.error("Failed to get existing searches, not saving search", {
                status,
            });

            throw new createHttpError.BadGateway();
        }

        const existingSearches: UserSearches = result.data;
        const newSearches: UserSearches = consolidateSearches(
            existingSearches,
            body
        );

        const postResult = await integrations.udpPostSearches({
            headers: { "requesting-service-user-id": auth.userId },
            body: newSearches,
        });

        if (!postResult.ok) {
            const { status } = postResult.error;

            if (status === 409) {
                logger.error(
                    "Update rejected because a newer version already exists",
                    {
                        status,
                        userId: auth.userId,
                    }
                );

                throw new createHttpError.Conflict();
            }

            logger.error("Failed to update user searches", { status });

            throw new createHttpError.BadGateway();
        }

        logger.info("Successfully updated searches", { data: postResult.data });

        return { status: 204 };
    }
);

const consolidateSearches = (
    existingSearches: UserSearches,
    newSearch: SearchTerm
): UserSearches => {
    if (newSearch.term.length > MAX_SEARCH_TERM_LENGTH) {
        return existingSearches;
    }

    if (existingSearches.searches.userSearches.length === MAX_SEARCH_TERMS) {
        existingSearches.searches.userSearches.pop();
    }

    existingSearches.searches.userSearches.push(newSearch);

    return existingSearches;
};
