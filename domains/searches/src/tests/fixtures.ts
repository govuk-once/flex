import { SearchTerm, UserSearches } from "@schemas/search";

export const makeSearchTerm = (term: string): SearchTerm => {
  return {
    term,
    timestamp: "2026-11-04T13:45:00Z",
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
