import { z } from "zod";

export const visitedPageSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  date: z.int(),
  url: z.url(),
});

export const inboundAddVisitedPageRequestSchema = visitedPageSchema;
