import { z } from "zod";

export const inboundPreferencesRequestSchema = z.object({
  preferences: z.object({
    notifications: z.object({
      consentStatus: z.enum(["unknown", "accepted", "denied"]),
    }),
  }),
});

export type InboundPreferencesRequest = z.infer<
  typeof inboundPreferencesRequestSchema
>;
