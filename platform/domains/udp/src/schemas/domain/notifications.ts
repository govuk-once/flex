import { z } from "zod";

import { consentStatusSchema, notificationIdSchema } from "../common";

export const inboundCreateOrUpdateNotificationsRequestSchema = z.object({
  consentStatus: consentStatusSchema,
  notificationId: notificationIdSchema,
});

export type InboundCreateOrUpdateNotificationsRequest = z.infer<
  typeof inboundCreateOrUpdateNotificationsRequestSchema
>;

export const domainNotificationsResponseSchema = z.object({
  consentStatus: consentStatusSchema,
  notificationId: notificationIdSchema,
});

export type DomainNotificationsResponse = z.infer<
  typeof domainNotificationsResponseSchema
>;
