import { IsoDateTime, NonEmptyString, Slug } from "@flex/utils";
import { z } from "zod";

/**
 * A travel row as stored in the shared `sources` table.
 *
 * The table holds sources for every namespace, so this describes only the
 * attributes a travel row is seeded with. Anything else on the item — the keys,
 * `URL`, `accessMethod`, operator-owned fields — is stripped on parse.
 */
export const TravelSourceSchema = z.object({
  sourceEnabled: z.boolean(),
  lastUpdated: IsoDateTime,
  sourceDetail: z.object({
    slug: Slug,
    country: NonEmptyString,
    synonyms: z.array(z.string()),
  }),
});

export type TravelSource = z.output<typeof TravelSourceSchema>;

export const CountrySchema = z
  .object({
    country: NonEmptyString,
    slug: Slug,
    lastUpdate: IsoDateTime,
    synonyms: z.array(z.string()),
  })
  .meta({ id: "Country" });

export type Country = z.output<typeof CountrySchema>;

export const CountriesResponseSchema = z
  .array(CountrySchema)
  .meta({ id: "CountriesResponse" });

export type CountriesResponse = z.output<typeof CountriesResponseSchema>;

/** Maps a stored row onto the shape callers see. */
export function toCountry({
  lastUpdated,
  sourceDetail,
}: TravelSource): Country {
  return {
    country: sourceDetail.country,
    slug: sourceDetail.slug,
    lastUpdate: lastUpdated,
    synonyms: sourceDetail.synonyms,
  };
}
