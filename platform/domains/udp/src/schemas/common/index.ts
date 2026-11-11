import { z } from "zod";

export const consentStatusSchema = z.enum(["unknown", "accepted", "denied"]);

export const pushIdSchema = z.string().optional();

export const topicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});

export const selectedTopicsSchema = z.array(topicSchema);

export const topicsSchema = z.object({
  topics: z.object({
    selectedTopics: selectedTopicsSchema,
  }),
});

export const searchTermSchema = z.object({
  term: z.string().min(1),
  timestamp: z.iso.datetime(),
});

export const selectedSearchesSchema = z.array(searchTermSchema);

export const userSearchesSchema = z.object({
  searches: z.object({
    selectedSearches: selectedSearchesSchema,
  }),
});
