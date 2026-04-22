import z from "zod";

import {
  NotificationPatchSchema,
  NotificationRequestSchema,
  NotificationSchema,
  NotificationsPatchRequestSchema,
  NotificationsRequestSchema,
  NotificationsSchema,
} from "../domain/notification";

export type NotificationRequestSchema = z.infer<
  typeof NotificationRequestSchema
>;

export type NotificationsRequestSchema = z.infer<
  typeof NotificationsRequestSchema
>;

export type NotificationsPatchRequestSchema = z.infer<
  typeof NotificationsPatchRequestSchema
>;

export type NotificationPatchBody = z.infer<typeof NotificationPatchSchema>;

export type GetNotificationResponseSchema = z.infer<typeof NotificationSchema>;

export type GetNotificationsResponseSchema = z.infer<
  typeof NotificationsSchema
>;
