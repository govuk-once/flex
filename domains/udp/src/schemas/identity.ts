import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const configSchema = z.object({
  FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: z.string().min(1),
  AWS_REGION: z.string().min(1),
});

export const identityPathSchema = z.object({
  serviceName: NonEmptyString,
  identifier: NonEmptyString,
});

export const identitySchema = z.object({
  appId: NonEmptyString,
  accessToken: NonEmptyString.optional(),
  refreshToken: NonEmptyString.optional(),
  idToken: NonEmptyString.optional(),
});

export type IdentityRequest = z.infer<typeof identitySchema>;
