import { NonEmptyString } from "@flex/utils";
import z from "zod";

export const authenticateResponseSchema = z.object({
  "id-token": NonEmptyString,
  apiKeyExpiry: NonEmptyString,
  passwordExpiry: NonEmptyString,
});
