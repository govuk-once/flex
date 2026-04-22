import { NonEmptyString } from "@flex/utils";
import z from "zod";

export const NotificationRequestSchema = z.object({
  pushId: NonEmptyString,
});

export const NotificationsRequestSchema = z.object({
  pushId: NonEmptyString,
  notificationId: NonEmptyString,
});

export const NotificationStatusSchema = z.enum([
  "RECEIVED",
  "READ",
  "MARKED_AS_UNREAD",
]);

export const NotificationPatchSchema = z.object({
  Status: NotificationStatusSchema,
});

export const NotificationsPatchRequestSchema = z.object({
  pushId: NonEmptyString,
  notificationId: NonEmptyString,
  body: NotificationPatchSchema,
});

export const NotificationSchema = z.object({
  NotificationID: z.string(),
  Status: NotificationStatusSchema,
  NotificationTitle: z.string(),
  NotificationBody: z.string(),
  DispatchedDateTime: z.iso.datetime(),
  MessageTitle: z.string(),
  MessageBody: z.string(),
});

export const NotificationsSchema = z.array(NotificationSchema);
