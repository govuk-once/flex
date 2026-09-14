import { z } from "zod";

import { topicsSchema } from "../common";

export const topicsResponseSchema = z.object({ data: topicsSchema });
export type TopicsResponse = z.infer<typeof topicsResponseSchema>;

export const upsertTopicsResponseSchema = z.object({
  data: topicsSchema,
});
export type UpsertTopicsResponse = z.infer<typeof upsertTopicsResponseSchema>;
