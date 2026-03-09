import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const identitySchema = z.object({
  appId: NonEmptyString,
  accessToken: NonEmptyString.optional(),
  refreshToken: NonEmptyString.optional(),
  idToken: NonEmptyString.optional(),
});

export type IdentityRequest = z.infer<typeof identitySchema>;
