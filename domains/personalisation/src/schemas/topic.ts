import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const TopicSchema = z.object({
  id: NonEmptyString,
  title: NonEmptyString,
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
