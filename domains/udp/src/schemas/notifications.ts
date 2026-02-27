import { z } from "zod";

export const CONSENT_STATUS_SCHEMA = z.enum(["unknown", "accepted", "denied"]);

const notificationIdSchema = z.string().optional();

export const createNotificationRequestSchema = z.object({
  consentStatus: CONSENT_STATUS_SCHEMA,
  notificationId: notificationIdSchema,
});

export type CreateNotificationRequest = z.infer<
  typeof createNotificationRequestSchema
>;

export const createNotificationResponseSchema = z.object({
  consentStatus: CONSENT_STATUS_SCHEMA,
  notificationId: notificationIdSchema,
});

export type CreateNotificationResponse = z.infer<
  typeof createNotificationResponseSchema
>;

export const getNotificationResponseSchema = z.object({
  consentStatus: CONSENT_STATUS_SCHEMA,
  notificationId: notificationIdSchema,
});

export type GetNotificationResponse = z.infer<
  typeof getNotificationResponseSchema
>;

export const updateNotificationRequestSchema = z.object({
  consentStatus: CONSENT_STATUS_SCHEMA,
  notificationId: notificationIdSchema,
});

export type UpdateNotificationRequest = z.infer<
  typeof updateNotificationRequestSchema
>;
