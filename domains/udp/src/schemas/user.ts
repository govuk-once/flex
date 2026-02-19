import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const createUserRequestSchema = z.object({
  notificationId: NonEmptyString,
  appId: NonEmptyString,
});

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;
