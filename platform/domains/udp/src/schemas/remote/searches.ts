import { z } from "zod";

import { userSearchesSchema } from "../common";

export const SearchesResponseSchema = z.object({
  data: userSearchesSchema,
});
export type SearchesResponse = z.infer<typeof SearchesResponseSchema>;
