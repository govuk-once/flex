import crypto from "node:crypto";

import type { UserId } from "@flex/utils";
import type { NotificationId } from "@schemas/notifications";

/**
 * Generates a notification ID using HMAC-SHA256 with base64url encoding.
 *
 * @param userId - The user's pairwise ID ({@link UserId}).
 * @param key - The secret key for HMAC derivation.
 * @returns A notification ID ({@link NotificationId}).
 */
export const getNotificationId = (userId: UserId, key: string) => {
  if (!userId.trim() || !key.trim()) {
    throw new Error("User ID and secret key cannot be empty");
  }

  return crypto
    .createHmac("sha256", key)
    .update(userId)
    .digest("base64url") as NotificationId;
};
