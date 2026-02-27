import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const UserPreferencesSchema = z.object({
  preferences: z.object({
    notifications: z.object({
      consentStatus: z.enum(["unknown", "accepted", "denied"]),
    }),
  }),
});

export const UserPreferencesRequestSchema = UserPreferencesSchema;

export const UserPreferencesResponseSchema = UserPreferencesSchema;

export const CreateUserRequestSchema = z.object({
  notificationId: NonEmptyString,
  appId: NonEmptyString,
});

export const UserProfileResponseSchema = z.object({
  notificationId: NonEmptyString,
  appId: NonEmptyString,
  preferences: z.object({
    notifications: z.object({
      consentStatus: z.enum(["unknown", "accepted", "denied"]),
    }),
  }),
});
