import { z } from "zod";

export const VisitedPageSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  date: z.int(),
  url: z.url(),
});
export const GetVisitedPagesResponseSchema = z.array(VisitedPageSchema);
export type GetVisitedPagesResponse = z.output<
  typeof GetVisitedPagesResponseSchema
>;
export type VisitedPage = z.output<typeof VisitedPageSchema>;
