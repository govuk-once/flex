import { z } from "zod";

const topicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});

const selectedTopicsSchema = z.object({
  topics: z.object({
    selectedTopics: z.array(topicSchema),
  }),
});

export const inboundUpsertTopicsRequestSchema = selectedTopicsSchema;

export type InboundUpsertTopicsRequest = z.infer<
  typeof inboundUpsertTopicsRequestSchema
>;

export const domainTopicsResponseSchema = selectedTopicsSchema;

export type DomainTopicsResponse = z.infer<typeof domainTopicsResponseSchema>;
