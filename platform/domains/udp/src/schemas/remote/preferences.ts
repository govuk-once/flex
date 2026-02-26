import { z } from "zod";

const consentStatusSchema = z.enum(["unknown", "accepted", "denied"]);

export const notificationsResponseSchema = z.object({
  data: z.object({
    consentStatus: consentStatusSchema,
  }),
});

export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;

export const preferencesRequestSchema = z.object({
  configuration: z
    .object({
      expiryMechanism: z.literal("DELETE"),
      expiresAt: z.number().int(),
    })
    .optional(),
  data: z.object({
    consentStatus: consentStatusSchema,
  }),
});

export type PreferencesRequest = z.infer<typeof preferencesRequestSchema>;
