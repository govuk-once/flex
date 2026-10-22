import { z } from "zod";

export const SearchSchema = z.object({
  term: z.string().min(1),
  timestamp: z.string().min(1),
});
export type Search = z.infer<typeof SearchSchema>;

const SelectedSearchesSchema = z.object({
  searches: z.object({
    selectedSearches: z.array(SearchSchema),
  }),
});
export type SelectedSearches= z.infer<typeof SelectedSearchesSchema>;

export const GetSelectedSearchesResponseSchema = SelectedSearchesSchema;
export type GetSelectedSearchesResponse = z.infer<
  typeof GetSelectedSearchesResponseSchema
>;

export const UpdateSelectedSearchesRequestSchema = SelectedSearchesSchema;
export type UpdateSelectedSearchesRequest = z.infer<
    typeof UpdateSelectedSearchesRequestSchema
>;

export const UpdateSelectedSearchesResponseSchema = SelectedSearchesSchema;
export type UpdateSelectedSearchesResponse = z.infer<
    typeof UpdateSelectedSearchesResponseSchema
>;
