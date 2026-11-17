import { z } from "zod";

import { visitedPageSchema } from "../domain/pages";

export const VisitedPagesResponseSchema = z.object({
  data: z.array(visitedPageSchema),
});
export type VisitedPagesResponse = z.infer<typeof VisitedPagesResponseSchema>;
