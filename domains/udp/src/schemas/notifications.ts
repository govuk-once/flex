import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

import { notificationId } from "./common";

export const CONSENT_STATUS_SCHEMA = z.enum(["unknown", "accepted", "denied"]);

export const createNotificationRequestSchema = z.object({
  consentStatus: CONSENT_STATUS_SCHEMA,
  notificationId,
});

export type CreateNotificationRequest = z.infer<
  typeof createNotificationRequestSchema
>;

export const createNotificationResponseSchema = z.object({
  consentStatus: CONSENT_STATUS_SCHEMA,
  notificationId,
});

export type CreateNotificationResponse = z.infer<
  typeof createNotificationResponseSchema
>;

export const getNotificationResponseSchema = z.object({
  consentStatus: CONSENT_STATUS_SCHEMA,
  notificationId,
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

export const updateNotificationOutboundRequestSchema =
  updateNotificationRequestSchema.extend({
    notificationId,
  });

export type UpdateNotificationOutboundRequest = z.infer<
  typeof updateNotificationOutboundRequestSchema
>;

export const updateNotificationResponseSchema = z.object({
  consentStatus: CONSENT_STATUS_SCHEMA,
  notificationId,
});

export type UpdateNotificationResponse = z.infer<
  typeof updateNotificationResponseSchema
>;

export type NotificationSecretContext = {
  notificationSecretKey: string;
};

export const getUserPreferencesResponseSchema = z.object({
  userId: NonEmptyString,
  notificationId,
  preferences: z.object({
    notifications: z.object({
      consentStatus: CONSENT_STATUS_SCHEMA,
      notificationId,
    }),
  }),
});

export type GetUserPreferencesResponse = z.infer<
  typeof getUserPreferencesResponseSchema
>;
