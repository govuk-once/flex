import { z } from "zod";

export const TopicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});

const SelectedTopicsSchema = z.object({
  topics: z.object({
    selectedTopics: z.array(TopicSchema),
  }),
});

// TODO: Rename to UpdateTopicsRequest - use notifications as a guide
export const TopicsRequestSchema = SelectedTopicsSchema;
export type TopicsRequest = z.infer<typeof TopicsRequestSchema>;

export const TopicsResponseSchema = SelectedTopicsSchema;
export type TopicsResponse = z.infer<typeof TopicsResponseSchema>;

export type Topic = z.infer<typeof TopicSchema>;
