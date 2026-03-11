import { z } from "zod";

import {
  createIdentityResponseSchema,
  getIdentityRequestSchema,
  getIdentityResponseSchema,
  identityRequestBodySchema,
  identityRequestSchema,
} from "../domain/identity";

export type identityBodyRequest = z.infer<typeof identityRequestBodySchema>;

export type identityRequest = z.infer<typeof identityRequestSchema>;

export type CreateIdentityResponse = z.infer<
  typeof createIdentityResponseSchema
>;

export type GetIdentityResponse = z.infer<typeof getIdentityResponseSchema>;

export type GetIdentityRequest = z.infer<typeof getIdentityRequestSchema>;
