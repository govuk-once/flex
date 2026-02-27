import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

import { inboundCreateUserRequestSchema } from "../domain/user";

// TODO: true ACL should re-map inbound to remote
export const remoteCreateUserRequestSchema = inboundCreateUserRequestSchema;

export type CreateUserRequest = z.infer<typeof remoteCreateUserRequestSchema>;

export const createUserResponseSchema = z.object({
  message: NonEmptyString,
});

export type CreateUserResponse = z.infer<typeof createUserResponseSchema>;
