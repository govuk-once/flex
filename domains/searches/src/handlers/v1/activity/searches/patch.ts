import { route } from "@domain";
import { SearchTerm, UserSearches } from "@schemas/search";
import createHttpError from "http-errors";

export const MAX_SEARCH_TERM_LENGTH = 100;
export const MAX_SEARCH_TERMS = 10;

export const handler = route(
  "PATCH /v1/activity/searches",
  async ({ auth, body, integrations, logger }) => {
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

    let existingUserSearches: UserSearches;
    if (result.ok) {
      existingUserSearches = result.data;
    } else {
      const { status } = result.error;

      if (status === 404) {
        logger.info(
          "Existing search data not found, setting up new collection for user",
          {
            status,
            userId: auth.userId,
          },
        );
        existingUserSearches = {
          searches: {
            selectedSearches: [],
          },
        };
      } else {
        logger.error("Failed to get existing searches, not saving search", {
          status,
        });

        throw new createHttpError.BadGateway();
      }
    }

    const uniqueSearches: SearchTerm[] = removeDuplicates(
      existingUserSearches.searches.selectedSearches,
      body,
    );

    const limitedSearches: SearchTerm[] = limitArraySize(
      uniqueSearches,
      MAX_SEARCH_TERMS,
    );

    // Push on the new term
    limitedSearches.push(body);

    const newUserSearches: UserSearches = {
      searches: {
        selectedSearches: limitedSearches,
      },
    };

    const postResult = await integrations.udpPostSearches({
      headers: { "requesting-service-user-id": auth.userId },
      body: newUserSearches,
    });

    if (!postResult.ok) {
      const { status, message, body } = postResult.error;

      if (status === 409) {
        logger.error("Update rejected because a newer version already exists", {
          status,
          userId: auth.userId,
        });

        throw new createHttpError.Conflict();
      }

      const fullMessage = `Failed to update user searches (${message}), (${JSON.stringify(body)})`;
      logger.error(fullMessage, { status });

      throw new createHttpError.BadGateway();
    }

    logger.info("Successfully updated searches");

    return { status: 201 };
  },
);

export const removeDuplicates = (
  existingSearches: SearchTerm[],
  newSearch: SearchTerm,
): SearchTerm[] => {
  return existingSearches.filter(
    (search) => search.term.toLowerCase() !== newSearch.term.toLowerCase(),
  );
};

export const limitArraySize = (
  existingSearches: SearchTerm[],
  maxArraySize: number,
): SearchTerm[] => {
  if (existingSearches.length === maxArraySize) {
    existingSearches.splice(0, 1);
  }

  return existingSearches;
};
