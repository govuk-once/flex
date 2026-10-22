import { z } from "zod";

import { searchesSchema } from "../common";

export const inboundUpdateSelectedSearchesRequestSchema = searchesSchema;
export type InboundUpdateSelectedSearchesRequest = z.infer<
    typeof inboundUpdateSelectedSearchesRequestSchema
>;

export const domainSearchesSchema = searchesSchema;
export type DomainSearches = z.infer<typeof domainSearchesSchema>;
