import { route } from "@domain";
import { SearchTerm, UserSearches } from "@schemas/search";
import createHttpError from "http-errors";

export const handler = route(
  "DELETE /v1/activity/searches/:term",
  async (ctx) => {
    const { auth, pathParams, integrations, logger } = ctx;
    let newSearchTerms: SearchTerm[] = [];

    if (pathParams.term.length > 0) {
      const normalisedTermToRemove: string = decodeURIComponent(
        pathParams.term,
      ).toLowerCase();
      const result = await integrations.udpGetSearches({
        headers: { "requesting-service-user-id": auth.userId },
      });

      let existingUserSearches: UserSearches;
      if (result.ok) {
        existingUserSearches = result.data;
      } else {
        const { status } = result.error;

        if (status === 404) {
          logger.info("Existing search data not found, returning", {
            userId: auth.userId,
          });

          return { status: 201 };
        } else {
          logger.error("Failed to get existing searches, not saving search", {
            status,
          });

          throw new createHttpError.BadGateway();
        }
      }

      const existingSearchTerms: SearchTerm[] =
        existingUserSearches.searches.selectedSearches;
      if (existingSearchTerms.length === 0) {
        logger.info("Existing search data is empty, returning", {
          userId: auth.userId,
        });

        return { status: 201 };
      }

      const matchedTerm = existingSearchTerms.find(
        ({ term }) =>
          term.toLowerCase() === normalisedTermToRemove.toLowerCase(),
      );
      if (matchedTerm === undefined) {
        logger.info(
          "Existing search data does not contain specified term, returning",
          {
            userId: auth.userId,
          },
        );

        return { status: 201 };
      }

      newSearchTerms = existingSearchTerms.filter(
        (searchTerm) =>
          searchTerm.term.toLowerCase() !==
          normalisedTermToRemove.toLowerCase(),
      );
    }

    const postResult = await integrations.udpPostSearches({
      headers: { "requesting-service-user-id": auth.userId },
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
          userId: auth.userId,
        });

        throw new createHttpError.Conflict();
      }

      const fullMessage = `Failed to delete user search (${message}), (${JSON.stringify(body)})`;
      logger.error(fullMessage, { status });

      throw new createHttpError.BadGateway();
    }

    logger.info("Successfully deleted search");

    return { status: 201 };
  },
);
