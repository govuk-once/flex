import { z } from "zod";

const consentDataSchema = z.object({
  consentStatus: z.string(),
  updatedAt: z.string(),
});

// JSON:API-style envelope - API may return { data: {...} } or just {...}
export const consentResponseSchema = z.union([
  z.object({ data: consentDataSchema }),
  consentDataSchema,
]);

export type ConsentData = z.output<typeof consentDataSchema>;

export const parseJsonResponse = async <T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> => {
  const raw = await response.json();
  return schema.parse(raw);
};
