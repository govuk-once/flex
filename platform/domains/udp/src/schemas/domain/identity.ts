import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const identityRequestBodySchema = z.object({
  appId: NonEmptyString,
  accessToken: NonEmptyString.optional(),
  refreshToken: NonEmptyString.optional(),
  idToken: NonEmptyString.optional(),
});

export const identityRequestSchema = z.object({
  serviceName: NonEmptyString,
  identifier: NonEmptyString,
  body: identityRequestBodySchema,
});

export const createIdentityResponseSchema = z.object({
  message: NonEmptyString,
});
