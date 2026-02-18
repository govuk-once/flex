import crypto from "crypto";

interface GeneratedDerivedIdProps {
  pairwiseId: string;
  secretKey: string;
}

/**
 * Generates a derived ID using HMAC-SHA256 with base64url encoding. This is a deterministic function that can be used to generate a unique ID for a given pairwise ID and secret key.
 * Empty strings are not allowed for the pairwise ID or secret key.
 *
 * @param props - The props for generating the derived ID.
 * @param props.pairwiseId - The pairwise ID to use for the derivation.
 * @param props.secretKey - The secret key to use for the derivation.
 * @returns The derived ID.
 */
export const generateDerivedId = ({
  pairwiseId,
  secretKey,
}: GeneratedDerivedIdProps) => {
  if (!pairwiseId.trim() || !secretKey.trim()) {
    throw new Error("Pairwise ID and secret key cannot be empty");
  }

  const hmac = crypto.createHmac("sha256", secretKey);
  hmac.update(pairwiseId);
  return hmac.digest("base64url");
};
