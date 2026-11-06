import { createFixtureBuilder } from "@flex/testing";
import { SearchTerm, UserSearches } from "@schemas/search";

const searchTimestamp = "2026-11-04T13:45:00Z";

const baseSearch: SearchTerm = {
  term: "a search",
  timestamp: searchTimestamp,
};

export const createSearch = createFixtureBuilder<SearchTerm>(baseSearch);

const baseSearches: UserSearches = {
  searches: {
    selectedSearches: [
      { term: "search 1", timestamp: searchTimestamp },
      { term: "search 2", timestamp: searchTimestamp },
    ],
  },
};

const emptySearches: UserSearches = {
  searches: {
    selectedSearches: [],
  },
};

export const createSearches = createFixtureBuilder<UserSearches>(baseSearches);
export const createEmptySearches =
  createFixtureBuilder<UserSearches>(emptySearches);
