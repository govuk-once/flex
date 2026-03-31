import { IsoDateTime, NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const NotificationStatusSchema = z.enum([
  "RECEIVED",
  "READ",
  "MARKED_AS_UNREAD",
  "HIDDEN",
]);

export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

export const NotificationSchema = z.object({
  NotificationID: NonEmptyString,
  NotificationTitle: NonEmptyString,
  NotificationBody: NonEmptyString,
  MessageTitle: NonEmptyString,
  MessageBody: NonEmptyString,
  DispatchedDateTime: IsoDateTime,
  Status: NotificationStatusSchema.optional(),
});

export type Notification = z.infer<typeof NotificationSchema>;

export const PatchNotificationBodySchema = z.object({
  Status: z.enum(["RECEIVED", "READ", "MARKED_AS_UNREAD"]),
});

export type PatchNotificationBody = z.infer<typeof PatchNotificationBodySchema>;
