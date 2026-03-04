import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const inboundCreateUserRequestSchema = z.object({
  notificationId: NonEmptyString,
  appId: NonEmptyString,
});

export type InboundCreateUserRequest = z.infer<
  typeof inboundCreateUserRequestSchema
>;
