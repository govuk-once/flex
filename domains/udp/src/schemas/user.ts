import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const createUserRequestSchema = z.object({
  notificationId: NonEmptyString,
  appId: NonEmptyString,
});

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const createUserResponseSchema = z.object({
  message: NonEmptyString,
});

export type CreateUserResponse = z.infer<typeof createUserResponseSchema>;

export const userProfileResponseSchema = z.object({
  notificationId: NonEmptyString,
  appId: NonEmptyString,
  preferences: z.object({
    notifications: z.object({
      consentStatus: z.enum(["unknown", "accepted", "denied"]),
    }),
  }),
});

export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;
