import { NonEmptyString, Slug, Url } from "@flex/utils";
import { z } from "zod";

export const TierSchema = z.enum([
  "county",
  "district",
  "unitary",
  "metropolitan",
  "london_borough",
]);
export type Tier = z.output<typeof TierSchema>;

export const ParentAuthoritySchema = z.object({
  name: NonEmptyString,
  homepage_url: Url,
  tier: TierSchema,
  slug: Slug,
});
export type ParentAuthority = z.output<typeof ParentAuthoritySchema>;

export const LocalAuthoritySchema = z.object({
  local_authority: z.object({
    name: NonEmptyString,
    homepage_url: Url,
    tier: TierSchema,
    slug: Slug,
    parent: ParentAuthoritySchema.optional(),
  }),
});
export type LocalAuthority = z.output<typeof LocalAuthoritySchema>;

export const LocalAuthorityResponseSchema = LocalAuthoritySchema;

export type LocalAuthorityResponse = z.output<
  typeof LocalAuthorityResponseSchema
>;
