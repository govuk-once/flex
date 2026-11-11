import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const authenticateResponseSchema = z
  .object({
    access_token: NonEmptyString,
    token_type: NonEmptyString,
    expires_in: z.number().int().positive(),
    ext_expires_in: z.number().int().positive(),
  })
  .meta({ id: "AuthenticateResponse" });
