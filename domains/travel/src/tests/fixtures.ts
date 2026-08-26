import { createFixtureBuilder, createUserId } from "@flex/testing";
import type { Country, Event } from "@flex/travel-service-gateway";

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

const baseEvent: Event = {
  namespace: "travel",
  group: "france",
  eventNote: "A update for france",
  eventTimestamp: "2026-08-14T09:00:00.000Z",
};

export const createEvent = createFixtureBuilder<Event>(baseEvent);
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
