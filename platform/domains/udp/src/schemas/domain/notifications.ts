import { z } from "zod";

import { consentStatusSchema, pushIdSchema } from "../common";

export const inboundCreateOrUpdateNotificationsRequestSchema = z.object({
  consentStatus: consentStatusSchema,
  pushId: pushIdSchema,
});

export type InboundCreateOrUpdateNotificationsRequest = z.infer<
  typeof inboundCreateOrUpdateNotificationsRequestSchema
>;

export const domainNotificationsResponseSchema = z.object({
  consentStatus: consentStatusSchema,
  pushId: z.string(),
});

export type DomainNotificationsResponse = z.infer<
  typeof domainNotificationsResponseSchema
>;
