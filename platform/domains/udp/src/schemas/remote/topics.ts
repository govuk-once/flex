import { z } from "zod";

const topicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});

export const upsertTopicsResponseSchema = z.object({
  data: z.object({
    topics: z.object({
      selectedTopics: z.array(topicSchema),
    }),
  }),
});

export type UpsertTopicsResponse = z.infer<typeof upsertTopicsResponseSchema>;
