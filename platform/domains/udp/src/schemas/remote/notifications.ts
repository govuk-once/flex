import { z } from "zod";

import { consentStatusSchema, notificationIdSchema } from "../common";

export const notificationsResponseSchema = z.object({
  data: z.object({
    consentStatus: consentStatusSchema,
    notificationId: z.string(),
  }),
});

export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;

export const createOrUpdateNotificationsRequestSchema = z.object({
  data: z.object({
    consentStatus: consentStatusSchema,
    notificationId: notificationIdSchema,
  }),
});

export type CreateOrUpdateNotificationsRequest = z.infer<
  typeof createOrUpdateNotificationsRequestSchema
>;

export const createOrUpdateNotificationsResponseSchema = z.object({
  data: z.object({
    consentStatus: consentStatusSchema,
    notificationId: z.string(),
  }),
});

export type CreateOrUpdateNotificationsResponse = z.infer<
  typeof createOrUpdateNotificationsResponseSchema
>;
