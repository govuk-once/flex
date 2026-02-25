import { IsoDateTime } from "@flex/utils";
import { z } from "zod";

export const preferencesResponseSchema = z.object({
  preferences: z.object({
    notifications: z.object({
      consentStatus: z.enum(["unknown", "accepted", "denied"]),
      updatedAt: IsoDateTime,
    }),
  }),
});

export type PreferencesResponse = z.infer<typeof preferencesResponseSchema>;

export const preferencesRequestSchema = z.object({
  notifications: z.object({
    consentStatus: z.enum(["unknown", "accepted", "denied"]),
  }),
});

export type PreferencesRequest = z.infer<typeof preferencesRequestSchema>;
