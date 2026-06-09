import { z } from "zod";

const MAX_DEPTH = 10;

const toNumberArray = (value: string) =>
  value.split(",").map((part) => Number(part.trim()));

export const cascadeQuerySchema = z.object({
  delays: z
    .string()
    .transform(toNumberArray)
    .pipe(z.array(z.number().int().min(0)).min(1).max(MAX_DEPTH)),
  hop: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : 0))
    .pipe(z.number().int().min(0)),
});

export type CascadeQuery = z.infer<typeof cascadeQuerySchema>;
