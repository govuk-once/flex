import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

import { inboundCreateUserRequestSchema } from "../inbound/user";

// support future update to remote contract
export const remoteCreateUserRequestSchema = inboundCreateUserRequestSchema;

export type CreateUserRequest = z.infer<typeof remoteCreateUserRequestSchema>;

export const createUserResponseSchema = z.object({
  message: NonEmptyString,
});

export type CreateUserResponse = z.infer<typeof createUserResponseSchema>;
