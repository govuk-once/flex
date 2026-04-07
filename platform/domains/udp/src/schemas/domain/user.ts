import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const inboundCreateUserRequestSchema = z.object({
  pushId: NonEmptyString,
  userId: NonEmptyString,
});

export type InboundCreateUserRequest = z.infer<
  typeof inboundCreateUserRequestSchema
>;
