import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const JwkSchema = z.object({
  kty: z.literal("RSA"),
  use: NonEmptyString.optional(),
  alg: NonEmptyString.optional(),
  kid: NonEmptyString,
  n: NonEmptyString,
  e: NonEmptyString,
});

export const JwkSetSchema = z.object({
  keys: z.array(JwkSchema),
});
