import { z } from "zod";

export const NotificationStatusSchema = z.enum([
  "RECEIVED",
  "READ",
  "MARKED_AS_UNREAD",
  "HIDDEN",
]);

export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

export const NotificationSchema = z.object({
  NotificationID: z.string().uuid(),
  NotificationTitle: z.string(),
  NotificationBody: z.string(),
  MessageTitle: z.string(),
  MessageBody: z.string(),
  DispatchedAt: z.string(),
  Status: NotificationStatusSchema.optional(),
});

export type Notification = z.infer<typeof NotificationSchema>;

export const PatchNotificationBodySchema = z.object({
  Status: z.enum(["RECEIVED", "READ", "MARKED_AS_UNREAD"]),
});

export type PatchNotificationBody = z.infer<typeof PatchNotificationBodySchema>;
