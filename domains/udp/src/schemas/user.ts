import { NonEmptyString, UserId } from "@flex/utils";
import { z } from "zod";

import {
  NotificationPreferencesConsentStatus,
  PushIdBranded,
} from "./notifications";

export const CreateUserRequestSchema = z.object({
  userId: UserId,
  pushId: PushIdBranded,
});

export type CreateUserRequest = z.output<typeof CreateUserRequestSchema>;

export const CreateUserResponseSchema = z.object({
  message: NonEmptyString,
});

export type CreateUserResponse = z.output<typeof CreateUserResponseSchema>;

export const GetUserResponseSchema = z.object({
  userId: UserId,
  notifications: z.object({
    consentStatus: NotificationPreferencesConsentStatus,
    pushId: PushIdBranded,
  }),
});

export type GetUserResponse = z.output<typeof GetUserResponseSchema>;
