import { createFixtureBuilder, createUserId } from "@flex/testing";
import { SearchTerm, UserSearches } from "@schemas/search";

const searchTimestamp = Date.now().toLocaleString();

const baseSearch: SearchTerm = {
    term: "a search",
    timestamp: searchTimestamp,
};

export const createSearch = createFixtureBuilder<SearchTerm>(baseSearch);

const baseSearches: UserSearches = {
    searches: {
        userSearches: [
            { term: "search 1", timestamp: searchTimestamp },
            { term: "search 2", timestamp: searchTimestamp },
        ],
    },
};

const emptySearches: UserSearches = {
    searches: {
        userSearches: [],
    },
};

export const createSearches = createFixtureBuilder<UserSearches>(baseSearches);
export const createEmptySearches =
    createFixtureBuilder<UserSearches>(emptySearches);
