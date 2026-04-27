import { UpdateNotificationPreferencesOutboundResponseSchema } from "@flex/udp-domain";
import { z } from "zod";

export const UpdateNotificationPreferencesOutboundResponseWithFeatureFlagSchema =
  UpdateNotificationPreferencesOutboundResponseSchema.extend({
    featureFlags: z.object({
      newUserProfileEnabled: z.boolean(),
    }),
  });
export type UpdateNotificationPreferencesOutboundResponseWithFeatureFlag =
  z.output<
    typeof UpdateNotificationPreferencesOutboundResponseWithFeatureFlagSchema
  >;

export const NotificationsResponseSchema = z.array(
  z.object({
    NotificationID: z.string(),
    Status: z.enum(["RECEIVED", "READ", "MARKED_AS_UNREAD"]),
    NotificationTitle: z.string(),
    NotificationBody: z.string(),
    DispatchedDateTime: z.iso.datetime(),
    MessageTitle: z.string().optional(),
    MessageBody: z.string().optional(),
  }),
);
export type NotificationsResponse = z.output<
  typeof NotificationsResponseSchema
>;
