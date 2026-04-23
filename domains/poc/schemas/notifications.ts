import { UpdateNotificationPreferencesOutboundResponseSchema } from "@flex/udp-domain";
import { z } from "zod";

export const UpdateNotificationPreferencesOutboundResponseWithFeatureFlagSchema =
  UpdateNotificationPreferencesOutboundResponseSchema.extend({
    featureFlags: z.object({
      newUserProfileEnabled: z.boolean(),
    }),
  });

export const NotificationsResponseSchema = z.array(
  z.object({
    NotificationID: z.string(),
    Status: z.enum(["RECEIVED", "READ", "MARKED_AS_UNREAD"]),
    NotificationTitle: z.string(),
    NotificationBody: z.string(),
    DispatchedDateTime: z.iso.datetime(),
    MessageTitle: z.string(),
    MessageBody: z.string(),
  }),
);

export type NotificationsResponseResponse = z.output<
  typeof NotificationsResponseSchema
>;
