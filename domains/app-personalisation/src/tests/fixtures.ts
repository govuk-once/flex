import { createFixtureBuilder, createUserId } from "@flex/testing";
import type { SearchTerm, UserSearches } from "@schemas/search";
import type { SelectedTopics } from "@schemas/topic";

export const userId = createUserId("test-app-personalisation-user");

// Topics

const baseTopics: SelectedTopics = {
  topics: {
    selectedTopics: [
      { id: "topic-1", title: "Topic One" },
      { id: "topic-2", title: "Topic Two" },
    ],
  },
};

export const createTopics = createFixtureBuilder<SelectedTopics>(baseTopics);

export const emptyTopics = { topics: { selectedTopics: [] } };
export const singleTopic = {
  topics: { selectedTopics: [{ id: "topic-1", title: "Topic One" }] },
};

// Searches

export const makeSearchTerm = (term: string): SearchTerm => {
  const event = new Date();
  return {
    term,
    timestamp: event.toISOString(),
  };
};

export const newSearchTerm: SearchTerm = makeSearchTerm("a new search");
export const testSearchTermBase: string = "search term";

export const makeFilledSearches = (terms: number): UserSearches => {
  const selectedSearches: SearchTerm[] = [];
  for (let i = 0; i < terms; i++) {
    selectedSearches.push(
      makeSearchTerm(`(${testSearchTermBase}) (${i.toString()})`),
    );
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
