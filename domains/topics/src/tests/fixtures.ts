import { createUserId, mergeFixture } from "@flex/testing";
import type { DeepPartial } from "@flex/utils";
import type { TopicsRequest } from "@schemas/topic";

export { createUserId };
export const userId = createUserId("test-topics-user");

export const createTopicsRequest = (overrides?: DeepPartial<TopicsRequest>) =>
  mergeFixture<TopicsRequest>(
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
export const topicsRequest = createTopicsRequest();

export const clearSelectionsRequest = createTopicsRequest({
  topics: { selectedTopics: [] },
});
