import { NonEmptyString } from "@flex/utils";
import { UserId } from "@flex/utils";
import { z } from "zod";

import { notificationId } from "./common";

export const createUserRequestSchema = z.object({
  notificationId,
  userId: UserId,
});

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const createUserResponseSchema = z.object({
  message: NonEmptyString,
});

export type CreateUserResponse = z.infer<typeof createUserResponseSchema>;
