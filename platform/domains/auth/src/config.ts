import z from "zod";

export const configSchema = z.looseObject({
  AWS_REGION: z.string().min(1),
  USERPOOL_ID_PARAM_NAME: z.string().min(1),
  CLIENT_ID_PARAM_NAME: z.string().min(1),
  JWKS_URI: z.url(),
});
