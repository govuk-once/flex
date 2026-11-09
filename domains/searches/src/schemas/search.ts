import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const SearchTermSchema = z.object({
  term: NonEmptyString,
  timestamp: NonEmptyString,
});
export type SearchTerm = z.infer<typeof SearchTermSchema>;

export const UserSearchesSchema = z.object({
  searches: z.object({
    selectedSearches: z.array(SearchTermSchema),
  }),
});
export type UserSearches = z.infer<typeof UserSearchesSchema>;

export const UpdateUserSearchRequestSchema = SearchTermSchema;
export type UpdateUserSearchRequest = z.infer<
  typeof UpdateUserSearchRequestSchema
>;

export const UpsertUserSearchResponseSchema = z.object({ data: UserSearchesSchema });
