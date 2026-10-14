import { createFixtureBuilder, createUserId } from "@flex/testing";
import type { SelectedTopics } from "@schemas/topic";

export const userId = createUserId("test-topics-user");

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
