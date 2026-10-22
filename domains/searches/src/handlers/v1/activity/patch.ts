import { route, routeContext } from "@domain";
import type { UserId } from "@flex/utils";
import createHttpError from "http-errors";

const context = routeContext<"PATCH /v1/activity/searches">;

export const handler = route("PATCH /v1/activity/searches", async ({ auth }) => {
    const userId = auth.pairwiseId as UserId;

    await updateSearches(userId);

    return { status: 204 };
});

async function updateSearches(userId: UserId): Promise<void> {
    const { body, integrations, logger } = context();

    const result = await integrations.udpPostSearches({
        headers: { "requesting-service-user-id": userId },
        body,
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
