import { route } from "@domain";
import { SearchTerm, UserSearches } from "@schemas/search";
import createHttpError from "http-errors";

export const handler = route(
  "DELETE /v1/activity/searches/:term",
  async (ctx) => {
    const { auth, pathParams, integrations, logger } = ctx;
    const userId = auth.userId;
    let newSearchTerms: SearchTerm[];

    if (pathParams.term.length > 0) {
      const normalisedTermToRemove: string = decodeURIComponent(
        pathParams.term,
      ).toLowerCase();
      const result = await integrations.udpGetSearches({
        headers: { "requesting-service-user-id": userId },
      });

      let existingUserSearches: UserSearches;
      if (result.ok) {
        existingUserSearches = result.data;
      } else if (result.error.status === 404) {
        logger.info("Existing search data not found, returning", {
          userId: userId,
        });

        return { status: 204 };
      } else {
        logger.error("Failed to get existing searches, not saving search", {
          userId: userId,
        });

        throw new createHttpError.BadGateway();
      }

      const existingSearchTerms: SearchTerm[] =
        existingUserSearches.searches.selectedSearches;

      if (termNeedsRemoving(existingSearchTerms, normalisedTermToRemove)) {
        newSearchTerms = existingSearchTerms.filter(
          (searchTerm) =>
            searchTerm.term.toLowerCase() !== normalisedTermToRemove,
        );
      } else {
        logger.info(
          "Existing search data does not contain the specified search term, returning",
          {
            userId: userId,
          },
        );

        return { status: 200 };
      }
    } else {
      logger.info("No valid term specified, returning", {
        userId: userId,
      });

      return { status: 201 };
    }

    const postResult = await integrations.udpPostSearches({
      headers: { "requesting-service-user-id": userId },
      body: {
        searches: {
          selectedSearches: newSearchTerms,
        },
      },
    });

    if (!postResult.ok) {
      const { status, message, body } = postResult.error;

      if (status === 409) {
        logger.error("Delete rejected because a newer version already exists", {
          status,
          userId: userId,
        });

        throw new createHttpError.Conflict();
      }

      logger.error(
        `Failed to delete specified user search (${message}), (${JSON.stringify(body)})`,
        { status },
      );

      throw new createHttpError.BadGateway();
    }

    logger.info("Successfully deleted search");

    return { status: 201 };
  },
);

export const termNeedsRemoving = (
  existingSearches: SearchTerm[],
  termToRemove: string,
): boolean => {
  if (existingSearches.length === 0) {
    return false;
  }

  const matchedTerm = existingSearches.find(
    ({ term }) => term.toLowerCase() === termToRemove,
  );

  return matchedTerm !== undefined;
};
