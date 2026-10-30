import { z } from "zod";

export const SearchTermSchema = z.object({
  term: z.string().min(1),
  timestamp: z.string().min(1),
});
export type SearchTerm = z.infer<typeof SearchTermSchema>
export const NewSearch = SearchTermSchema;

const UserSearchesSchema = z.object({
  searches: z.object({
    selectedSearches: z.array(SearchTermSchema),
  }),
})

const SelectedSearchesSchema = z.object({
  searches: z.object({
    selectedSearches: z.array(SearchTermSchema),
  }),
});
export type SelectedSearches = z.infer<typeof SelectedSearchesSchema>;

export type UserSearches = z.infer<typeof UserSearchesSchema>
export const Searches = UserSearchesSchema;
