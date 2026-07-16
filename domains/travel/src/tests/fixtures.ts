import { mergeFixture } from "@flex/testing";
import { GetCountriesResponse } from "@flex/travel-service-gateway";

export const createCountries = (overrides?: Partial<GetCountriesResponse>) =>
  mergeFixture<GetCountriesResponse>(
    {
      countries: [
        {
          countryId: "00a2d263-f4cc-4ed1-9ae8-ce5e73ce4d30",
          countryName: "Italy",
        },
        {
          countryId: "726afbd8-e8d1-4ef8-a3a8-9d0a4c467014",
          countryName: "Gibraltar",
        },
      ],
    },
    overrides,
  );
export const countries = createCountries();
