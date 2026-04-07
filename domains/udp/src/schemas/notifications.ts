import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const PushIdBranded = NonEmptyString.brand<"PushId">();

export type PushId = z.output<typeof PushIdBranded>;

export const NotificationPreferencesConsentStatus = z.enum([
  "unknown",
  "accepted",
  "denied",
]);

export const CreateNotificationPreferencesRequestSchema = z.object({
  consentStatus: NotificationPreferencesConsentStatus,
  pushId: PushIdBranded,
});

export type CreateNotificationPreferencesRequest = z.output<
  typeof CreateNotificationPreferencesRequestSchema
>;

export const CreateNotificationPreferencesResponseSchema = z.object({
  consentStatus: NotificationPreferencesConsentStatus,
  pushId: PushIdBranded,
});

export type CreateNotificationPreferencesResponse = z.output<
  typeof CreateNotificationPreferencesResponseSchema
>;

export const GetNotificationPreferencesResponseSchema = z.object({
  consentStatus: NotificationPreferencesConsentStatus,
  pushId: PushIdBranded,
});

export type GetNotificationPreferencesResponse = z.output<
  typeof GetNotificationPreferencesResponseSchema
>;

export const UpdateNotificationPreferencesRequestSchema = z.object({
  consentStatus: NotificationPreferencesConsentStatus,
});

export type UpdateNotificationPreferencesRequest = z.output<
  typeof UpdateNotificationPreferencesRequestSchema
>;

export const UpdateNotificationPreferencesResponseSchema = z.object({
  consentStatus: NotificationPreferencesConsentStatus,
});

export type UpdateNotificationPreferencesResponse = z.output<
  typeof UpdateNotificationPreferencesResponseSchema
>;

export const UpdateNotificationPreferencesOutboundRequestSchema =
  UpdateNotificationPreferencesRequestSchema.extend({
    pushId: PushIdBranded,
  });

export type UpdateNotificationPreferencesOutboundRequest = z.output<
  typeof UpdateNotificationPreferencesOutboundRequestSchema
>;

export const UpdateNotificationPreferencesOutboundResponseSchema =
  UpdateNotificationPreferencesResponseSchema.extend({
    pushId: PushIdBranded,
  });

export type UpdateNotificationPreferencesOutboundResponse = z.output<
  typeof UpdateNotificationPreferencesOutboundResponseSchema
>;
