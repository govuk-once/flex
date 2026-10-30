import {route, routeContext} from "@domain";
import type {UserId} from "@flex/utils";
import createHttpError from "http-errors";
import {getSearches} from "./get";
import {UserSearches} from "@schemas/search";

const context = routeContext<"PATCH /v1/activity/searches">;
const maxTermLength = 100
const maxTerms = 10

export const handler = route("PATCH /v1/activity/searches", async ({ auth }) => {
    const userId = auth.pairwiseId as UserId;
    const { body, logger } = context();

    const searchToSave = body
    if (searchToSave && searchToSave.term.length > maxTermLength) {
        logger.warn("Search term too long", {
            searchToSave,
            userId,
        });

        return { status: 201 };
    }

    // TODO: need to check for a case-insensitive existing match and treat as a nothing to do
    // TODO: need mechanism to guarantee ordering by creation datetime

    const userSearches: UserSearches = {searches: []} //(await getSearches(integrations, logger, userId))
    userSearches.searches.push(searchToSave)

    const numSearches = userSearches.searches.length
    if (numSearches > maxTerms) {
        // TODO: need to rotate properly
        userSearches.searches.pop()
    }

    await updateSearches(userSearches, userId);

    return { status: 204 };
});

async function updateSearches(userSearches: UserSearches, userId: UserId): Promise<void> {
    const { integrations, logger } = context();

    const result = await integrations.udpPostSearches({
        headers: {"requesting-service-user-id": userId},
        body: userSearches
    });

    if (!result.ok) {
        const { status } = result.error;

        if (status === 409) {
            logger.error("Update rejected because a newer version already exists", {
                status,
                userId,
            });

            throw new createHttpError.Conflict();
        }

        logger.error("Failed to update user searches", { status });
        throw new createHttpError.BadGateway();
    }

    logger.debug("User searches updated successfully");
}
