import { route } from "@domain";

export const handler = route(
  "DELETE /v1/activity/searches",
  async ({ auth, integrations, logger }) => {
    const postResult = await integrations.udpPostSearches({
      headers: { "requesting-service-user-id": auth.userId },
      body: {
        searches: {
          selectedSearches: [],
        },
      },
    });

    if (!postResult.ok) {
      logger.info(
        `Post of empty (deleted) collection returned error ${JSON.stringify(postResult.error)} - returning`,
        {
          userId: auth.userId,
        },
      );
    } else {
      logger.info("Successfully deleted all user searches");
    }

    return { status: 201 };
  },
);
