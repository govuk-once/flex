import { z } from "zod";

import { NonEmptyString, Slug, Uuid } from "../common";

export const TopicId = Uuid.meta({
  id: "TopicId",
  description: "Unique identifier for a topic",
  example: "[UUID v4]",
});
export type TopicId = z.output<typeof TopicId>;

export const TopicRef = Slug.meta({
  id: "TopicRef",
  description: "Unique reference slug for a topic",
  example: "driving-transport",
});
export type TopicRef = z.output<typeof TopicRef>;

export const GetTopicsInput = z.object({
  // query: z.object({}),
});
export type GetTopicsInput = z.output<typeof GetTopicsInput>;

export const GetTopicsOutput = z.object({
  body: z.object({
    topics: z.array(
      z.object({
        id: TopicId,
        ref: TopicRef,
        title: NonEmptyString,
      }),
    ),
  }),
});
export type GetTopicsOutput = z.output<typeof GetTopicsOutput>;
