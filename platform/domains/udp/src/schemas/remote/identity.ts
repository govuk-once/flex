import { z } from "zod";

import {
  createIdentityResponseSchema,
  identityRequestBodySchema,
  identityRequestSchema,
} from "../domain/identity";

export type identityBodyRequest = z.infer<typeof identityRequestBodySchema>;

export type identityRequest = z.infer<typeof identityRequestSchema>;

export type CreateIdentityResponse = z.infer<
  typeof createIdentityResponseSchema
>;
