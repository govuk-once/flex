import { createFixtureBuilder } from "@flex/testing";
import { SearchTerm, UserSearches } from "@schemas/search";

export const makeSearchTerm = (term: string): SearchTerm => {
  const event = new Date();
  return {
    term,
    timestamp: event.toISOString(),
  };
};

export const newSearchTerm: SearchTerm = makeSearchTerm("a new search");

export const makeFilledSearches = (terms: number): UserSearches => {
  const selectedSearches: SearchTerm[] = [];
  for (let i = 0; i < terms; i++) {
    selectedSearches.push(makeSearchTerm(`search term (${i.toString()})`));
  }

  return {
    searches: {
      selectedSearches,
    },
  };
};

export const baseSearches: UserSearches = {
  searches: {
    selectedSearches: [],
  },
};

export const createSearches = createFixtureBuilder<UserSearches>(baseSearches);
