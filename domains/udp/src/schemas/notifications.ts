import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const NotificationIdBranded = NonEmptyString.brand<"NotificationId">();

export type NotificationId = z.output<typeof NotificationIdBranded>;

export const NotificationPreferencesConsentStatus = z.enum([
  "unknown",
  "accepted",
  "denied",
]);

export const CreateNotificationPreferencesRequestSchema = z.object({
  consentStatus: NotificationPreferencesConsentStatus,
  notificationId: NotificationIdBranded,
});

export type CreateNotificationPreferencesRequest = z.output<
  typeof CreateNotificationPreferencesRequestSchema
>;

export const CreateNotificationPreferencesResponseSchema = z.object({
  consentStatus: NotificationPreferencesConsentStatus,
  notificationId: NotificationIdBranded,
});

export type CreateNotificationPreferencesResponse = z.output<
  typeof CreateNotificationPreferencesResponseSchema
>;

export const GetNotificationPreferencesResponseSchema = z.object({
  consentStatus: NotificationPreferencesConsentStatus,
  notificationId: NotificationIdBranded,
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
    notificationId: NotificationIdBranded,
  });

export type UpdateNotificationPreferencesOutboundRequest = z.output<
  typeof UpdateNotificationPreferencesOutboundRequestSchema
>;

export const UpdateNotificationPreferencesOutboundResponseSchema =
  UpdateNotificationPreferencesResponseSchema.extend({
    notificationId: NotificationIdBranded,
    featureFlags: z.object({
      newUserProfileEnabled: z.boolean(),
    }),
  });

export type UpdateNotificationPreferencesOutboundResponse = z.output<
  typeof UpdateNotificationPreferencesOutboundResponseSchema
>;
