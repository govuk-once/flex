import { z } from "zod";

import { topicsSchema } from "../common";

export const inboundUpdateSelectedTopicsRequestSchema = topicsSchema;
export type InboundUpdateSelectedTopicsRequest = z.infer<
  typeof inboundUpdateSelectedTopicsRequestSchema
>;

export const domainTopicsSchema = topicsSchema;
export type DomainTopics = z.infer<typeof domainTopicsSchema>;
