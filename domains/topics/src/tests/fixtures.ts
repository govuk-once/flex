import { createFixtureBuilder, createUserId } from "@flex/testing";
import { type SelectedTopics, TopicIdBranded } from "@schemas/topic";

export const userId = createUserId("test-topics-user");

export const createTopicId = (value: string) => {
  return TopicIdBranded.parse(value);
};

const baseTopics: SelectedTopics = {
  topics: {
    selectedTopics: [
      { id: createTopicId("topic-1"), title: "Topic One" },
      { id: createTopicId("topic-2"), title: "Topic Two" },
    ],
  },
};

export const createTopics = createFixtureBuilder<SelectedTopics>(baseTopics);

export const emptyTopics = { topics: { selectedTopics: [] } };
export const singleTopic = {
  topics: { selectedTopics: [{ id: "topic-1", title: "Topic One" }] },
};
