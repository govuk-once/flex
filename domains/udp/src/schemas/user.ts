import { NonEmptyString, UserId } from "@flex/utils";
import { z } from "zod";

import {
  NotificationIdBranded,
  NotificationPreferencesConsentStatus,
} from "./notifications";

export const CreateUserRequestSchema = z.object({
  userId: UserId,
  notificationId: NotificationIdBranded,
});

export type CreateUserRequest = z.output<typeof CreateUserRequestSchema>;

export const CreateUserResponseSchema = z.object({
  message: NonEmptyString,
});

export type CreateUserResponse = z.output<typeof CreateUserResponseSchema>;

export const GetUserResponseSchema = z.object({
  userId: UserId,
  notificationId: NotificationIdBranded,
  notifications: z.object({
    consentStatus: NotificationPreferencesConsentStatus,
    notificationId: NotificationIdBranded,
  }),
});

export type GetUserResponse = z.output<typeof GetUserResponseSchema>;
