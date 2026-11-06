import { z } from "zod";

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

export const domainSearchesSchema = userSearchesSchema;
