import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const CountrySchema = z.object({
  countryId: NonEmptyString,
  countryName: NonEmptyString,
});
export type Country = z.output<typeof CountrySchema>;

export const GetCountriesResponseSchema = z.object({
  countries: z.array(CountrySchema),
});
export type GetCountriesResponse = z.output<typeof GetCountriesResponseSchema>;
