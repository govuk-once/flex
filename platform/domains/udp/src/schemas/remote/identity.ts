import { z } from "zod";

import {
  createIdentityRequestBodySchema,
  createIdentityRequestSchema,
  deleteIdentityRequestSchema,
  getIdentityRequestSchema,
  getIdentityResponseSchema,
  identityResponseSchema,
} from "../domain/identity";

export type CreateIdentityBodyRequest = z.infer<
  typeof createIdentityRequestBodySchema
>;

export type CreateIdentityRequest = z.infer<typeof createIdentityRequestSchema>;

export type IdentityResponse = z.infer<typeof identityResponseSchema>;

export type DeleteIdentityRequest = z.infer<typeof deleteIdentityRequestSchema>;

export type GetIdentityRequest = z.infer<typeof getIdentityRequestSchema>;

export type GetIdentityResponse = z.infer<typeof getIdentityResponseSchema>;
