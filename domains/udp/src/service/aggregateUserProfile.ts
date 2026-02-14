import { getLogger } from "@flex/logging";

import { createUserOrchestrator } from "./createUser";
import { getUserSettings } from "./getUserSettings";

interface AggregateUserProfileOptions {
  region: string;
  baseUrl: URL;
  pairwiseId: string;
  notificationId: string;
}

/**
 * Aggregates the user profile from the user settings and creates a user if they don't exist
 *
 * @param {AggregateUserProfileOptions} param0 - The options for aggregating the user profile
 * @returns {Promise<UserProfile>} The user profile
 */
export const aggregateUserProfile = async ({
  region,
  baseUrl,
  pairwiseId,
  notificationId,
}: AggregateUserProfileOptions) => {
  const logger = getLogger();
  const userSettings = await getUserSettings({ region, baseUrl, pairwiseId });
  if (!userSettings) {
    logger.debug(
      "User not found, creating user and setting default user settings",
    );
    await createUserOrchestrator({
      region,
      baseUrl,
      pairwiseId,
      notificationId,
    });
  }
  return await getUserSettings({ region, baseUrl, pairwiseId });
};
