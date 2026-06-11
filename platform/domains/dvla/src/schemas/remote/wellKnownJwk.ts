import z from "zod";
import { JwkSchema, JwkSetSchema } from "../domain/wellKnownJwk";

export type Jwk = z.infer<typeof JwkSchema>;
export type JwkSet = z.infer<typeof JwkSetSchema>;
