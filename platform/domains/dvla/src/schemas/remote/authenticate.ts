import z from "zod";

import { authenticateResponseSchema } from "../domain/authenticate";

export type AuthenticateResponseSchema = z.infer<
  typeof authenticateResponseSchema
>;
