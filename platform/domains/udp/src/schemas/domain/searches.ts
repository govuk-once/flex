import { z } from "zod";

export const searchTermSchema = z.object({
    term: z.string().min(1),
    timestamp: z.string().min(1),
});

export const userSearchesSchema = z.object({
    searches: z.array(searchTermSchema)
})
export const inboundUpdateUserSearchesRequestSchema = userSearchesSchema;

export const domainSearchesSchema = z.array(searchTermSchema);
