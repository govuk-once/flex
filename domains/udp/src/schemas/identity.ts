import { NonEmptyString } from "@flex/utils";
import { UserId } from "@flex/utils";
import { z } from "zod";

export const configSchema = z.object({
  FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: z.string().min(1),
  AWS_REGION: z.string().min(1),
});

export const identityPathSchema = z.object({
  serviceName: NonEmptyString,
  identifier: NonEmptyString,
});

export const getIdentityPathSchema = z.object({
  serviceName: NonEmptyString,
});

export const identitySchema = z.object({
  appId: UserId,
  accessToken: NonEmptyString.optional(),
  refreshToken: NonEmptyString.optional(),
  idToken: NonEmptyString.optional(),
});

export type IdentityRequest = z.infer<typeof identitySchema>;

export const identityDeleteSchema = z.object({
  userId: UserId,
});

export type IdentityDeleteRequest = z.infer<typeof identityDeleteSchema>;

export const identityGetSchema = z.object({
  serviceId: NonEmptyString,
  serviceName: NonEmptyString,
  accessToken: NonEmptyString.optional(),
  refreshToken: NonEmptyString.optional(),
  idToken: NonEmptyString.optional(),
});

export type IdentityGetSchema = z.infer<typeof identityGetSchema>;
