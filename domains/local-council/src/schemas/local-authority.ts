import { NonEmptyString, Slug, Url } from "@flex/utils";
import { z } from "zod";

const TierSchema = z.enum([
  "county",
  "district",
  "unitary",
  "metropolitan",
  "london_borough",
]);

const ParentAuthoritySchema = z.object({
  name: NonEmptyString,
  homepage_url: Url,
  tier: TierSchema,
  slug: Slug,
});

export const LocalAuthoritySchema = z.object({
  local_authority: z.object({
    name: NonEmptyString,
    homepage_url: Url,
    tier: TierSchema,
    slug: Slug,
    parent: ParentAuthoritySchema.optional(),
  }),
});

export type LocalAuthority = z.infer<typeof LocalAuthoritySchema>;

export const LocalAuthorityResponseSchema = LocalAuthoritySchema;

export type LocalAuthorityResponse = z.infer<
  typeof LocalAuthorityResponseSchema
>;
