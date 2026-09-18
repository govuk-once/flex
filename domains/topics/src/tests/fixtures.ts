import { createFixtureBuilder, createUserId } from "@flex/testing";
import type { TopicsRequest } from "@schemas/topic";

export const userId = createUserId("test-topics-user");

const baseTopics: TopicsRequest = {
  topics: {
    selectedTopics: [
      { id: "topic-1", title: "Topic One" },
      { id: "topic-2", title: "Topic Two" },
    ],
  },
};

export const createTopics = createFixtureBuilder<TopicsRequest>(baseTopics);
