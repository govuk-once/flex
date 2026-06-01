import { z } from "zod";

import {
  createIdentityRequestBodySchema,
  createIdentityRequestSchema,
  deleteIdentityRequestSchema,
  getIdentityRequestSchema,
  getIdentityResponseSchema,
  identitiesPostRequestSchema,
  identitiesRequestSchema,
  identitiesResponseSchema,
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

export type GetIdentitiesResponse = z.infer<typeof identitiesResponseSchema>;

export type GetIdentitiesRequest = z.infer<typeof identitiesRequestSchema>;

export type PostIdentitiesBody = z.infer<typeof identitiesPostRequestSchema>;
