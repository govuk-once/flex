import crypto from "node:crypto";

import type { UserId } from "@flex/utils";
import type { PushId } from "@schemas/notifications";

/**
 * Generates a Push Identity Token (PushId) using HMAC-SHA256 with base64url encoding.
 *
 * @param userId - The user's pairwise ID ({@link UserId}).
 * @param key - The secret key for HMAC derivation.
 * @returns A Push Identity Token ({@link PushId}).
 */
export const getPushId = (userId: UserId, key: string) => {
  if (!userId.trim() || !key.trim()) {
    throw new Error("User ID and secret key cannot be empty");
  }

  return crypto
    .createHmac("sha256", key)
    .update(userId)
    .digest("base64url") as PushId;
};
