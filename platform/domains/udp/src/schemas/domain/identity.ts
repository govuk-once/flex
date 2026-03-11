import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const getIdentityRequestBodySchema = z.object({
  appId: NonEmptyString,
});

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

// TODO is this correct?
export const getIdentityResponseSchema = z.object({
  message: NonEmptyString,
});

export const getIdentityRequestSchema = z.object({
  serviceName: NonEmptyString,
  userId: NonEmptyString,
});
