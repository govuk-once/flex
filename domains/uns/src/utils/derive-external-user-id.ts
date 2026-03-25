import crypto from "node:crypto";

export const deriveExternalUserId = (
  pairwise: string,
  secret: string,
): string =>
  crypto.createHmac("sha256", secret).update(pairwise).digest("base64url");
