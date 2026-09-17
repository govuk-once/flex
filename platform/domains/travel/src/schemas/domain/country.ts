import { IsoDateTime, NonEmptyString, Slug, Url, Uuid } from "@flex/utils";
import { z } from "zod";

export const TravelSourceItemSchema = z.object({
  sourceID: Uuid,
  compositeKey: NonEmptyString,
  sourceNamespace: NonEmptyString,
  sourceGroup: NonEmptyString,
  accessMethod: NonEmptyString,
  URL: Url,
  sourceEnabled: z.boolean(),
  lastUpdated: IsoDateTime,
  sourceDetail: z.object({
    country: NonEmptyString,
    slug: Slug,
    synonyms: z.array(z.string()),
  }),
});
export type TravelSourceItem = z.output<typeof TravelSourceItemSchema>;

export const CountrySchema = z
  .object({
    country: NonEmptyString,
    lastUpdate: IsoDateTime,
    slug: Slug,
    synonyms: z.array(z.string()),
  })
  .meta({ id: "Country" });
export type Country = z.output<typeof CountrySchema>;

export const GetCountriesResponseSchema = z
  .array(CountrySchema)
  .meta({ id: "GetCountriesResponse" });
export type GetCountriesResponse = z.output<typeof GetCountriesResponseSchema>;

/** Maps a stored row onto the shape callers see. */
export function toCountry(item: TravelSourceItem): Country {
  const {
    lastUpdated,
    sourceDetail: { country, slug, synonyms },
  } = item;

  return { country, slug, lastUpdate: lastUpdated, synonyms };
}
