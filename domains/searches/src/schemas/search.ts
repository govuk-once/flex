import { z } from "zod";

export const SearchTermSchema = z.object({
  term: z.string().min(1),
  timestamp: z.iso.datetime(),
});
export type SearchTerm = z.infer<typeof SearchTermSchema>;

export const UserSearchesSchema = z.object({
  searches: z.object({
    userSearches: z.array(SearchTermSchema),
  }),
});
export type UserSearches = z.infer<typeof UserSearchesSchema>;

export const UpdateUserSearchRequestSchema = SearchTermSchema;
export type UpdateUserSearchRequest = z.infer<
  typeof UpdateUserSearchRequestSchema
>;
