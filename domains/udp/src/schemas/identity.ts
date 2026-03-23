import { NonEmptyString } from "@flex/utils";
import { UserId } from "@flex/utils";
import { z } from "zod";

export const GetServiceIdentityLinkResponseSchema = z.object({
  serviceId: NonEmptyString,
  serviceName: NonEmptyString,
  accessToken: NonEmptyString.optional(),
  idToken: NonEmptyString.optional(),
  refreshToken: NonEmptyString.optional(),
});

export type GetServiceIdentityLinkResponse = z.output<
  typeof GetServiceIdentityLinkResponseSchema
>;

export const CreateServiceIdentityLinkRequestSchema = z.object({
  appId: UserId,
  accessToken: NonEmptyString.optional(),
  refreshToken: NonEmptyString.optional(),
  idToken: NonEmptyString.optional(),
});

export type CreateServiceIdentityLinkRequest = z.output<
  typeof CreateServiceIdentityLinkRequestSchema
>;

export const DeleteServiceIdentityLinkResponseSchema = z.object({
  userId: UserId,
});

export type DeleteServiceIdentityLinkResponse = z.output<
  typeof DeleteServiceIdentityLinkResponseSchema
>;
