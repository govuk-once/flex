import { z } from "zod";

export const CONSENT_STATUS_SCHEMA = z.enum(["unknown", "accepted", "denied"]);

export const createNotificationRequestSchema = z.object({
  consentStatus: CONSENT_STATUS_SCHEMA,
  notificationId: z.string(),
});

export type CreateNotificationRequest = z.infer<
  typeof createNotificationRequestSchema
>;

export const createNotificationResponseSchema = z.object({
  consentStatus: CONSENT_STATUS_SCHEMA,
  notificationId: z.string(),
});

export type CreateNotificationResponse = z.infer<
  typeof createNotificationResponseSchema
>;

export const getNotificationResponseSchema = z.object({
  consentStatus: CONSENT_STATUS_SCHEMA,
  notificationId: z.string(),
});

export type GetNotificationResponse = z.infer<
  typeof getNotificationResponseSchema
>;

export const updateNotificationRequestSchema = z.object({
  consentStatus: CONSENT_STATUS_SCHEMA,
});

export type UpdateNotificationRequest = z.infer<
  typeof updateNotificationRequestSchema
>;

export type NotificationSecretContext = {
  notificationSecretKey: string;
};
