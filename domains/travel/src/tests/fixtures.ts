import { createUserId, mergeFixture } from "@flex/testing";
import type { Country } from "@flex/travel-service-gateway";
import type { DeepPartial } from "@flex/utils";

export { createUserId };
export const userId = createUserId("test-travel-user");

export const createCountry = (overrides?: DeepPartial<Country>) =>
  mergeFixture<Country>(
    {
      country: "France",
      slug: "france",
      lastUpdate: "2026-08-14T09:00:00.000Z",
      synonyms: ["Frankreich"],
    },
    overrides,
  );
export const country = createCountry();

export const countries = [
  country,
  createCountry({ country: "Germany", slug: "germany", synonyms: [] }),
];
