import z from "zod";

export const configSchema = z.object({
  AWS_REGION: z.string().min(1),
  USERPOOL_ID: z.string().min(1),
  CLIENT_ID: z.string().min(1),
  JWKS_URI: z.url(),
});
