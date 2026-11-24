import {
  createFixtureBuilder,
  createUserId,
  mergeFixture,
} from "@flex/testing";
import type { DeepPartial } from "@flex/utils";
import type {
  LocalAuthority,
  ParentAuthority,
  Tier,
} from "@schemas/local-authority";
import type { SearchTerm, UserSearches } from "@schemas/search";
import type { SelectedTopics } from "@schemas/topic";

export const userId = createUserId("test-personalisation-user");

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

// Local council

export const createLocalCouncilId = (value = "test-localcouncil-id") => value;
export const localCouncilId = createLocalCouncilId();

export const createTier = (value: Tier = "county") => value;
export const tier = createTier();

export const createParentAuthority = (
  overrides?: DeepPartial<ParentAuthority>,
) =>
  mergeFixture<ParentAuthority>(
    {
      name: "Derbyshire County Council",
      homepage_url: "https://www.derbyshire.gov.uk/",
      tier,
      slug: "derbyshire",
    },
    overrides,
  );
export const parentAuthority = createParentAuthority();

export const createLocalAuthority = (overrides?: DeepPartial<LocalAuthority>) =>
  mergeFixture<LocalAuthority>(
    {
      local_authority: {
        name: "Derbyshire Dales District Council",
        homepage_url: "https://www.derbyshiredales.gov.uk/",
        tier: "district",
        slug: "derbyshire-dales",
        parent: parentAuthority,
      },
    },
    overrides,
  );
export const localAuthority = createLocalAuthority();
