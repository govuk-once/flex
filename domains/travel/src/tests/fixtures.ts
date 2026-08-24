import { createUserId, mergeFixture } from "@flex/testing";
import type { Country, Event } from "@flex/travel-service-gateway";
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

export const createEvent = (overrides?: DeepPartial<Event>) =>
  mergeFixture<Event>(
    {
      namespace: "travel",
      group: "france",
      eventNote: "A update for france",
      eventTimestamp: "2026-08-14T09:00:00.000Z",
    },
    overrides,
  );

export const event = createEvent();

export const events = [
  event,
  createEvent({
    namespace: "travel",
    group: "france",
    eventNote: "Another update for france",
    eventTimestamp: "2026-08-15T09:00:00.000Z",
  }),
];
