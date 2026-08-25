import { createFixtureBuilder, createUserId } from "@flex/testing";
import type { Country } from "@flex/travel-service-gateway";

export { createUserId };
export const userId = createUserId("test-travel-user");
const baseCountry: Country = {
  country: "France",
  slug: "france",
  lastUpdate: "2026-08-14T09:00:00.000Z",
  synonyms: ["Frankreich"],
};

export const createCountry = createFixtureBuilder<Country>(baseCountry);
export const country = createCountry();
export const countries = [
  country,
  createCountry({ country: "Germany", slug: "germany", synonyms: [] }),
];
