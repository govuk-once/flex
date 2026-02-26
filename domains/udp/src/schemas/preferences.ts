import { IsoDateTime } from "@flex/utils";
import { z } from "zod";

export const CONSENT_STATUS_SCHEMA = z.enum(["unknown", "accepted", "denied"]);

export const preferencesRequestSchema = z.object({
  preferences: z.object({
    notifications: z.object({
      consentStatus: CONSENT_STATUS_SCHEMA,
    }),
  }),
});

export type PreferencesRequest = z.infer<typeof preferencesRequestSchema>;

export const preferencesResponseSchema = z.object({
  preferences: z.object({
    notifications: z.object({
      consentStatus: CONSENT_STATUS_SCHEMA,
    }),
  }),
});

export type PreferencesResponse = z.infer<typeof preferencesResponseSchema>;
