import { route } from "@domain";
import { SearchTerm, UserSearches } from "@schemas/search";
import createHttpError from "http-errors";

const MAX_SEARCH_TERM_LENGTH = 100;
const MAX_SEARCH_TERMS = 10;

export const handler = route(
  "PATCH /v1/activity/searches",
  async ({ auth, body, integrations, logger }) => {
    // Terms over MAX_SEARCH_TERM_LENGTH are rejected
    if (body.term.length > MAX_SEARCH_TERM_LENGTH) {
      const status = 400;
      logger.error("Specified search is too long, not saving search", {
        status,
      });

      throw new createHttpError.BadRequest();
    }

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

    const foundSearches = result.data.searches.userSearches;
    const newSearches: SearchTerm[] = consolidateSearches(foundSearches, body);
    const newUserSearches: UserSearches = {
      searches: {
        userSearches: newSearches,
      },
    };

    logger.info("STEP 3: " + JSON.stringify(newUserSearches));
    const postResult = await integrations.udpPostSearches({
      headers: { "requesting-service-user-id": auth.userId },
      body: newUserSearches,
    });

    logger.info("STEP 4");
    if (!postResult.ok) {
      const { status } = postResult.error;

      if (status === 409) {
        logger.error("Update rejected because a newer version already exists", {
          status,
          userId: auth.userId,
        });

        throw new createHttpError.Conflict();
      }

      logger.error("Failed to update user searches", { status });

      throw new createHttpError.BadGateway();
    }

    logger.info("Successfully updated searches", { data: postResult.data });

    return { status: 204 };
  },
);

const consolidateSearches = (
  existingSearches: SearchTerm[],
  newSearch: SearchTerm,
): SearchTerm[] => {
  // Remove any existing (case-insensitive) match
  const indexToRemove: number = existingSearches.findIndex(
    (search) => search.term.toLowerCase() === newSearch.term.toLowerCase(),
  );

  if (indexToRemove >= 0) {
    existingSearches.splice(indexToRemove, 1);
  }

  // If array already has MAX_SEARCH_TERMS entries, remove the oldest
  if (existingSearches.length === MAX_SEARCH_TERMS) {
    existingSearches.splice(0, 1);
  }

  // Push on the new term
  existingSearches.push(newSearch);

  return existingSearches;
};
