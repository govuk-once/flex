import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const PushIdBranded = NonEmptyString.brand<"PushId">();
export type PushId = z.output<typeof PushIdBranded>;

export const ConsentStatusSchema = z.enum(["unknown", "accepted", "denied"]);
export type ConsentStatus = z.output<typeof ConsentStatusSchema>;

export const NotificationSchema = z.object({
  consentStatus: ConsentStatusSchema,
  pushId: PushIdBranded,
});
export type Notification = z.output<typeof NotificationSchema>;

// TODO: Improve types

export const NotificationPreferencesConsentStatus = ConsentStatusSchema;

export const CreateNotificationPreferencesRequestSchema = NotificationSchema;
export type CreateNotificationPreferencesRequest = z.output<
  typeof CreateNotificationPreferencesRequestSchema
>;

export const CreateNotificationPreferencesResponseSchema = NotificationSchema;
export type CreateNotificationPreferencesResponse = z.output<
  typeof CreateNotificationPreferencesResponseSchema
>;

export const GetNotificationPreferencesResponseSchema = NotificationSchema;
export type GetNotificationPreferencesResponse = z.output<
  typeof GetNotificationPreferencesResponseSchema
>;

export const UpdateNotificationPreferencesRequestSchema =
  NotificationSchema.pick({ consentStatus: true });
export type UpdateNotificationPreferencesRequest = z.output<
  typeof UpdateNotificationPreferencesRequestSchema
>;

export const UpdateNotificationPreferencesResponseSchema =
  NotificationSchema.pick({ consentStatus: true });
export type UpdateNotificationPreferencesResponse = z.output<
  typeof UpdateNotificationPreferencesResponseSchema
>;

export const UpdateNotificationPreferencesOutboundRequestSchema =
  NotificationSchema;
export type UpdateNotificationPreferencesOutboundRequest = z.output<
  typeof UpdateNotificationPreferencesOutboundRequestSchema
>;

export const UpdateNotificationPreferencesOutboundResponseSchema =
  NotificationSchema;
export type UpdateNotificationPreferencesOutboundResponse = z.output<
  typeof UpdateNotificationPreferencesOutboundResponseSchema
>;
