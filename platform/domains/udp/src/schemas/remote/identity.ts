import { z } from "zod";

import {
  createIdentityRequestBodySchema,
  createIdentityRequestSchema,
  deleteIdentityRequestSchema,
  exchangeIdentityResponseSchema,
  identityResponseSchema,
} from "../domain/identity";

export type CreateIdentityBodyRequest = z.infer<
  typeof createIdentityRequestBodySchema
>;

export type CreateIdentityRequest = z.infer<typeof createIdentityRequestSchema>;

export type IdentityResponse = z.infer<typeof identityResponseSchema>;

export type DeleteIdentityRequest = z.infer<typeof deleteIdentityRequestSchema>;

export type ExchangeIdentityResponse = z.infer<
  typeof exchangeIdentityResponseSchema
>;
