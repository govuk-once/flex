import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const createIdentityRequestBodySchema = z.object({
  appId: NonEmptyString,
  accessToken: NonEmptyString.optional(),
  refreshToken: NonEmptyString.optional(),
  idToken: NonEmptyString.optional(),
});

export const createIdentityRequestSchema = z.object({
  serviceName: NonEmptyString,
  identifier: NonEmptyString,
  body: createIdentityRequestBodySchema,
});

export const identityResponseSchema = z.object({
  message: NonEmptyString,
});

export const deleteIdentityRequestSchema = z.object({
  serviceName: NonEmptyString,
  appId: NonEmptyString,
});

export const exchangeIdentityResponseSchema = z.object({
  serviceId: NonEmptyString,
  serviceName: NonEmptyString,
  accessToken: NonEmptyString,
  refreshToken: NonEmptyString,
  idToken: NonEmptyString,
});
