import { z } from "zod";

import { searchesSchema } from "../common";

export const searchesResponseSchema = z.object({ data: searchesSchema });
export type SearchesResponse = z.infer<typeof searchesResponseSchema>;

export const upsertSearchesResponseSchema = z.object({ data: searchesSchema });
export type UpsertSearchesResponse = z.infer<typeof upsertSearchesResponseSchema>;
