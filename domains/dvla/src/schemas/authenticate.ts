import { NonEmptyString } from "@flex/utils";
import z from "zod";

export const authenticateResponseSchema = z
  .object({
    "id-token": NonEmptyString,
    apiKeyExpiry: NonEmptyString,
    passwordExpiry: NonEmptyString,
  })
  .meta({ id: "AuthenticateResponse" });

export type AuthenticateResponseSchema = z.infer<
  typeof authenticateResponseSchema
>;
