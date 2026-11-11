import { route } from "@domain";
import { UserSearches } from "@schemas/search";
import createHttpError from "http-errors";

export const handler = route(
    "PATCH /v1/activity/searches",
    async ({ auth, body, integrations, logger }) => {
        const searches: UserSearches = {
            searches: {
                userSearches: [{ term: body.term, timestamp: body.timestamp }],
            },
        };

        const result = await integrations.udpPostSearch({
            headers: { "requesting-service-user-id": auth.userId },
            body: searches,
        });

        if (!result.ok) {
            const { status } = result.error;

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

        logger.info("Successfully updated searches", { data: result.data });

        return { status: 204 };
    }
);
