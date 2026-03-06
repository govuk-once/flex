import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const identityRequestSchema = z.object({
  appId: NonEmptyString,
  accessToken: NonEmptyString.optional(),
  refreshToken: NonEmptyString.optional(),
  idToken: NonEmptyString.optional(),
});
