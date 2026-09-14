import { createUserId, mergeFixture } from "@flex/testing";
import type { DeepPartial } from "@flex/utils";
import type { SelectedTopics } from "@schemas/topic";

export { createUserId };
export const userId = createUserId("test-topics-user");

export const createSelectedTopics = (overrides?: DeepPartial<SelectedTopics>) =>
  mergeFixture<SelectedTopics>(
    {
      topics: {
        selectedTopics: [
          { id: "topic-1", title: "Topic One" },
          { id: "topic-2", title: "Topic Two" },
        ],
      },
    },
    overrides,
  );

export const selectedTopicsEmpty = createSelectedTopics({
  topics: { selectedTopics: [] },
});
export const selectedTopicsMultiple = createSelectedTopics();
export const selectedTopicsSingle = createSelectedTopics({
  topics: { selectedTopics: [{ id: "topic-1", title: "Single Topic" }] },
});
