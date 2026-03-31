import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const remoteCreateUserRequestSchema = z.object({
  pushId: NonEmptyString,
  appId: NonEmptyString,
});

export type CreateUserRequest = z.infer<typeof remoteCreateUserRequestSchema>;

export const createUserResponseSchema = z.object({
  message: NonEmptyString,
});

export type CreateUserResponse = z.infer<typeof createUserResponseSchema>;
