import crypto from "crypto";

interface GeneratedDerivedIdProps {
  pairwiseId: string;
  secretKey: string;
}

export const generateDerivedId = ({
  pairwiseId,
  secretKey,
}: GeneratedDerivedIdProps): string => {
  const hmac = crypto.createHmac("sha256", secretKey);
  hmac.update(pairwiseId);
  return hmac.digest("base64url");
};
