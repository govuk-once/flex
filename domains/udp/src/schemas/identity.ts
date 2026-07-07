import { NonEmptyString, UserId } from "@flex/utils";
import { z } from "zod";

export const ServiceIdentityLinkSchema = z.object({
  serviceId: NonEmptyString,
  serviceName: NonEmptyString,
  accessToken: NonEmptyString.optional(),
  idToken: NonEmptyString.optional(),
  refreshToken: NonEmptyString.optional(),
});
export type ServiceIdentityLink = z.output<typeof ServiceIdentityLinkSchema>;

export const ServiceIdentityLinkRequestSchema = z.object({
  appId: UserId,
  accessToken: NonEmptyString.optional(),
  refreshToken: NonEmptyString.optional(),
  idToken: NonEmptyString.optional(),
});
export type ServiceIdentityLinkRequest = z.output<
  typeof ServiceIdentityLinkRequestSchema
>;

// TODO: Improve types

export const GetServiceIdentityLinkResponseSchema = ServiceIdentityLinkSchema;
export type GetServiceIdentityLinkResponse = z.output<
  typeof GetServiceIdentityLinkResponseSchema
>;

export const CreateServiceIdentityLinkRequestSchema =
  ServiceIdentityLinkRequestSchema;
export type CreateServiceIdentityLinkRequest = z.output<
  typeof CreateServiceIdentityLinkRequestSchema
>;

export const DeleteServiceIdentityLinkResponseSchema = z.object({
  userId: UserId,
});

export type DeleteServiceIdentityLinkResponse = z.output<
  typeof DeleteServiceIdentityLinkResponseSchema
>;

export const GetIdentitiesGWResponseSchema = z.object({
  linkedServices: z.array(NonEmptyString),
});

export const GetIdentitiesResponseSchema = z.object({
  services: z.array(NonEmptyString),
});

export type GetIdentitiesResponse = z.output<
  typeof GetIdentitiesResponseSchema
>;

export type GetIdentitiesGWResponse = z.output<
  typeof GetIdentitiesResponseSchema
>;
