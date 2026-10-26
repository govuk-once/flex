import { z } from "zod";

export const SearchSchema = z.object({
  term: z.string().min(1),
  timestamp: z.string().min(1),
});
export type Search = z.infer<typeof SearchSchema>;

const UpdatedSearchesSchema = z.object({
  searches: z.object({
    newSearch: SearchSchema.optional(),
    existingSearches: z.array(SearchSchema),
  }),
});
export type UpdatedSearches= z.infer<typeof UpdatedSearchesSchema>;

const SelectedSearchesSchema = z.object({
  searches: z.object({
    existingSearches: z.array(SearchSchema),
  }),
});
export type SelectedSearches= z.infer<typeof SelectedSearchesSchema>;

export const GetSelectedSearchesResponseSchema = SelectedSearchesSchema;
export type GetSelectedSearchesResponse = z.infer<
  typeof GetSelectedSearchesResponseSchema
>;

export const UpdateSelectedSearchesRequestSchema = UpdatedSearchesSchema;
export type UpdateSelectedSearchesRequest = z.infer<
    typeof UpdateSelectedSearchesRequestSchema
>;

export const UpdateSelectedSearchesResponseSchema = SelectedSearchesSchema;
export type UpdateSelectedSearchesResponse = z.infer<
    typeof UpdateSelectedSearchesResponseSchema
>;
