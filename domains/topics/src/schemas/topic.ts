import { z } from "zod";

export const TopicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});
export type Topic = z.infer<typeof TopicSchema>;

const SelectedTopicsSchema = z.object({
  topics: z.object({
    selectedTopics: z.array(TopicSchema),
  }),
});
export type SelectedTopics = z.infer<typeof SelectedTopicsSchema>;

export const GetSelectedTopicsResponseSchema = SelectedTopicsSchema;
export type GetSelectedTopicsResponse = z.infer<
  typeof GetSelectedTopicsResponseSchema
>;

export const UpdateSelectedTopicsRequestSchema = SelectedTopicsSchema;
export type UpdateSelectedTopicsRequest = z.infer<
  typeof UpdateSelectedTopicsRequestSchema
>;

export const UpdateSelectedTopicsResponseSchema = SelectedTopicsSchema;
export type UpdateSelectedTopicsResponse = z.infer<
  typeof UpdateSelectedTopicsResponseSchema
>;
