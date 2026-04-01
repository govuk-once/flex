import crypto from "node:crypto";

export const deriveExternalUserId = (
  pairwiseId: string,
  secret: string,
): string =>
  crypto.createHmac("sha256", secret).update(pairwiseId).digest("base64url");
