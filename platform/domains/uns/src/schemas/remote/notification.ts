import z from "zod";

import {
  NotificationRequestSchema,
  NotificationSchema,
  NotificationsRequestSchema,
  NotificationsSchema,
  NotificationStatusSchema,
} from "../domain/notification";

export type NotificationRequestSchema = z.infer<
  typeof NotificationRequestSchema
>;

export type NotificationsRequestSchema = z.infer<
  typeof NotificationsRequestSchema
>;

export type PatchNotificationStatusResponseSchema = z.infer<
  typeof NotificationStatusSchema
>;

export type GetNotificationResponseSchema = z.infer<typeof NotificationSchema>;

export type GetNotificationsResponseSchema = z.infer<
  typeof NotificationsSchema
>;
