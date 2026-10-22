import { createFixtureBuilder, createUserId } from "@flex/testing";
import { SelectedSearches } from "@schemas/search";

export const userId = createUserId("test-searches-user");

const baseSearches: SelectedSearches = {
    searches: {
        selectedSearches: [
            { term: "term-1", timestamp: Date.now().toLocaleString() },
            { term: "term-2", timestamp: Date.now().toLocaleString() },
        ],
    },
};

export const createSearch = createFixtureBuilder<SelectedSearches>(baseSearches);

export const emptySearches = { searches: { selectedSearches: [] } };
export const singleSearch = {
    searches: { selectedSearches: [{  term: "term-1", timestamp: Date.now().toLocaleString() }] },
};
